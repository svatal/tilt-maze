import { BALL_RADIUS } from "./constants";
import { clamp, type HoleDef } from "./holeBowl";

/**
 * Past = černá díra: střed míčku v kruhu `trap.r` (vizuální poloměr) nebo smyk přes něj.
 * Mimo disk žádné síly. Po zachycení krátký pád → jeden respawn (řídí controller).
 */
export const TRAP_HOLE = {
  fallDurationMs: 280,
  fallLerp: 0.22,
  maxShrink: 0.38,
  boundaryEpsilon: 1e-4
} as const;

export type TrapDef = HoleDef;

export type TrapFallPhase = "idle" | "falling";

export type TrapFallState = {
  phase: TrapFallPhase;
  fallMs: number;
  activeTrapIndex: number | null;
};

export function initialTrapFallState(): TrapFallState {
  return { phase: "idle", fallMs: 0, activeTrapIndex: null };
}

export function ballCenterInsideTrapDisk(ballX: number, ballY: number, trap: TrapDef): boolean {
  return Math.hypot(ballX - trap.x, ballY - trap.y) <= trap.r + TRAP_HOLE.boundaryEpsilon;
}

/** Vzdálenost bodu (px,py) od úsečky (x1,y1)–(x2,y2). */
export function distancePointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const nx = x1 + t * dx;
  const ny = y1 + t * dy;
  return Math.hypot(px - nx, py - ny);
}

/** Úsek pohybu středu protne (nebo končí uvnitř) disku pasti. */
export function ballPathEntersTrapDisk(
  trap: TrapDef,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  if (ballCenterInsideTrapDisk(x2, y2, trap)) return true;
  if (Math.hypot(x2 - x1, y2 - y1) < 1e-6) return false;
  return distancePointToSegment(trap.x, trap.y, x1, y1, x2, y2) <= trap.r + TRAP_HOLE.boundaryEpsilon;
}

export function shouldTrapCapture(
  trap: TrapDef,
  ballX: number,
  ballY: number,
  prevX: number | null,
  prevY: number | null
): boolean {
  if (ballCenterInsideTrapDisk(ballX, ballY, trap)) return true;
  if (prevX != null && prevY != null) {
    return ballPathEntersTrapDisk(trap, prevX, prevY, ballX, ballY);
  }
  return false;
}

export function findTrapCapture(
  traps: TrapDef[],
  ballX: number,
  ballY: number,
  phase: TrapFallPhase,
  prevX: number | null = null,
  prevY: number | null = null
): number | null {
  if (phase !== "idle" || traps.length === 0) return null;
  let best: { i: number; dist: number } | null = null;

  for (let i = 0; i < traps.length; i++) {
    const tr = traps[i];
    if (!shouldTrapCapture(tr, ballX, ballY, prevX, prevY)) continue;
    const d = Math.hypot(ballX - tr.x, ballY - tr.y);
    if (!best || d < best.dist) best = { i, dist: d };
  }
  return best?.i ?? null;
}

export type TrapFallStepInput = {
  state: TrapFallState;
  traps: TrapDef[];
  ballX: number;
  ballY: number;
  deltaMs: number;
  allowCapture?: boolean;
  prevBallX?: number | null;
  prevBallY?: number | null;
};

export type TrapFallStepResult = {
  state: TrapFallState;
  sinkT: number;
  fallingActive: boolean;
  sinkCenterX: number | null;
  sinkCenterY: number | null;
  shouldRespawn: boolean;
};

export function stepTrapFall(input: TrapFallStepInput): TrapFallStepResult {
  let { state } = input;
  const { traps, deltaMs } = input;
  const none = {
    sinkT: 0,
    fallingActive: false,
    sinkCenterX: null as number | null,
    sinkCenterY: null as number | null,
    shouldRespawn: false
  };
  const prevX = input.prevBallX ?? null;
  const prevY = input.prevBallY ?? null;
  const allowCapture = input.allowCapture !== false;

  if (state.phase === "idle") {
    const idx = allowCapture
      ? findTrapCapture(traps, input.ballX, input.ballY, "idle", prevX, prevY)
      : null;
    if (idx == null) {
      return { state, ...none };
    }
    state = { phase: "falling", fallMs: 0, activeTrapIndex: idx };
  }

  if (state.phase !== "falling" || state.activeTrapIndex == null) {
    return { state, ...none };
  }

  const tr = traps[state.activeTrapIndex];
  if (!tr) {
    return { state: initialTrapFallState(), ...none };
  }

  state = { ...state, fallMs: state.fallMs + deltaMs };
  const sinkT = clamp(state.fallMs / TRAP_HOLE.fallDurationMs, 0, 1);
  const shouldRespawn = state.fallMs >= TRAP_HOLE.fallDurationMs;

  return {
    state: shouldRespawn ? initialTrapFallState() : state,
    sinkT,
    fallingActive: !shouldRespawn,
    sinkCenterX: tr.x,
    sinkCenterY: tr.y,
    shouldRespawn
  };
}

export function paintTrapHole(
  g: {
    fillStyle: (c: number, a?: number) => void;
    fillCircle: (x: number, y: number, r: number) => void;
    lineStyle: (w: number, c: number, a?: number) => void;
    strokeCircle: (x: number, y: number, r: number) => void;
  },
  trap: TrapDef,
  sinkT: number
): void {
  const { x, y, r } = trap;
  g.fillStyle(0x1a120a, 1);
  g.fillCircle(x, y, r + 2);
  g.fillStyle(0x2a0a0a, 0.92);
  g.fillCircle(x, y + sinkT * 1.2, r - 1);
  g.fillStyle(0x120404, 1);
  g.fillCircle(x, y + sinkT * 1.8, r * 0.55);
  g.lineStyle(2, 0x0a0604, 1);
  g.strokeCircle(x, y, r);
}

export const TRAP_TEST_DEFAULTS = { ballRadius: BALL_RADIUS };
