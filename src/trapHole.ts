import { BALL_RADIUS } from "./constants";
import { clamp, type HoleDef } from "./holeBowl";

/**
 * Past = „černá díra“: platí celý VIZUÁLNÍ poloměr `trap.r` (střed míčku).
 * Žádné výjimky pro rychlost, hloubku ani okraj. Mimo kruh žádné síly.
 */
export const TRAP_HOLE = {
  fallDurationMs: 280,
  fallDamping: 0.55,
  fallLerp: 0.22,
  maxShrink: 0.38,
  /** Tolerance pro hranici disku (px). */
  boundaryEpsilon: 1e-4
} as const;

export type TrapDef = HoleDef;

export type TrapFallPhase = "idle" | "falling" | "done";

export type TrapFallState = {
  phase: TrapFallPhase;
  fallMs: number;
  activeTrapIndex: number | null;
  respawnPending: boolean;
};

export function initialTrapFallState(): TrapFallState {
  return { phase: "idle", fallMs: 0, activeTrapIndex: null, respawnPending: false };
}

export function trapCaptureRadius(trap: TrapDef): number {
  return trap.r;
}

export function ballCenterInsideTrapDisk(ballX: number, ballY: number, trap: TrapDef): boolean {
  const r = trapCaptureRadius(trap);
  return Math.hypot(ballX - trap.x, ballY - trap.y) <= r + TRAP_HOLE.boundaryEpsilon;
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

/** Úsek pohybu středu míčku protne (nebo je uvnitř) disku pasti? */
export function ballPathEntersTrapDisk(
  trap: TrapDef,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  if (ballCenterInsideTrapDisk(x2, y2, trap)) return true;
  const travel = Math.hypot(x2 - x1, y2 - y1);
  if (travel < 1e-6) return false;
  const r = trapCaptureRadius(trap);
  const closest = distancePointToSegment(trap.x, trap.y, x1, y1, x2, y2);
  return closest <= r + TRAP_HOLE.boundaryEpsilon;
}

export function shouldTrapCapture(
  trap: TrapDef,
  ballX: number,
  ballY: number,
  _vx: number,
  _vy: number,
  _ballRadius: number,
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
  vx: number,
  vy: number,
  ballRadius: number,
  phase: TrapFallPhase,
  prevX: number | null = null,
  prevY: number | null = null
): number | null {
  if (phase !== "idle" || traps.length === 0) return null;
  let best: { i: number; dist: number } | null = null;

  for (let i = 0; i < traps.length; i++) {
    const tr = traps[i];
    if (!shouldTrapCapture(tr, ballX, ballY, vx, vy, ballRadius, prevX, prevY)) continue;
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
  vx: number;
  vy: number;
  ballRadius: number;
  deltaMs: number;
  allowCapture?: boolean;
  prevBallX?: number | null;
  prevBallY?: number | null;
  /** Simuluje vnější tilt po zachycení (nesmí uvolnit). */
  externalAccel?: { x: number; y: number };
};

export type TrapFallStepResult = {
  state: TrapFallState;
  pullFx: number;
  pullFy: number;
  sinkT: number;
  fallingActive: boolean;
  targetX: number | null;
  targetY: number | null;
  shouldRespawn: boolean;
};

export type TrapCrossSimResult = {
  captured: boolean;
  respawnCount: number;
  captureStep: number | null;
};

export type TrapMotionSimOpts = {
  trap: TrapDef;
  ballRadius: number;
  vx: number;
  vy?: number;
  steps?: number;
  deltaMs?: number;
  startX: number;
  startY: number;
};

export function simulateTrapMotion(opts: TrapMotionSimOpts): TrapCrossSimResult {
  const { trap, ballRadius, vx, vy = 0, steps = 48, deltaMs = 16, startX, startY } = opts;
  let state = initialTrapFallState();
  let x = startX;
  let y = startY;
  let prevX: number | null = null;
  let prevY: number | null = null;
  let respawnCount = 0;
  let captured = false;
  let captureStep: number | null = null;
  const frameScale = deltaMs / 16.666;

  for (let step = 0; step < steps; step++) {
    const r = stepTrapFall({
      state,
      traps: [trap],
      ballX: x,
      ballY: y,
      vx,
      vy,
      ballRadius,
      deltaMs,
      prevBallX: prevX,
      prevBallY: prevY,
      externalAccel: { x: vx * 0.01, y: vy * 0.01 }
    });
    state = r.state;
    if (r.shouldRespawn) respawnCount += 1;
    if (r.state.phase === "falling" && !captured) {
      captured = true;
      captureStep = step;
    }
    if (r.state.phase === "falling") {
      prevX = x;
      prevY = y;
      continue;
    }
    prevX = x;
    prevY = y;
    x += vx * frameScale;
    y += vy * frameScale;
  }
  return { captured, respawnCount, captureStep };
}

/** Horizontální průlet středem (regrese rychlosti). */
export function simulateTrapCenterCrossing(opts: {
  trap: TrapDef;
  ballRadius: number;
  vx: number;
  vy?: number;
  steps?: number;
  deltaMs?: number;
  startOffsetX?: number;
}): TrapCrossSimResult {
  const startOffsetX = opts.startOffsetX ?? -(opts.trap.r + opts.ballRadius + 8);
  return simulateTrapMotion({
    trap: opts.trap,
    ballRadius: opts.ballRadius,
    vx: opts.vx,
    vy: opts.vy,
    steps: opts.steps,
    deltaMs: opts.deltaMs,
    startX: opts.trap.x + startOffsetX,
    startY: opts.trap.y
  });
}

/** Tětiva se oběma konci MIMO disk, ale protíná viditelný kruh (okraj). */
export function simulateTrapChordBothEndsOutside(opts: {
  trap: TrapDef;
  ballRadius: number;
  vx: number;
  deltaMs?: number;
}): TrapCrossSimResult {
  const { trap, ballRadius, vx, deltaMs = 16 } = opts;
  const half = trap.r + 18;
  return simulateTrapMotion({
    trap,
    ballRadius,
    vx,
    deltaMs,
    steps: 56,
    startX: trap.x - half,
    startY: trap.y
  });
}

export function stepTrapFall(input: TrapFallStepInput): TrapFallStepResult {
  let { state } = input;
  const { traps, deltaMs } = input;
  const base = {
    pullFx: 0,
    pullFy: 0,
    sinkT: 0,
    fallingActive: false,
    targetX: null as number | null,
    targetY: null as number | null,
    shouldRespawn: false,
    state
  };

  if (state.phase === "done") {
    return base;
  }

  const allowCapture = input.allowCapture !== false;
  const prevX = input.prevBallX ?? null;
  const prevY = input.prevBallY ?? null;

  if (state.phase === "idle") {
    const idx = allowCapture
      ? findTrapCapture(
          traps,
          input.ballX,
          input.ballY,
          input.vx,
          input.vy,
          input.ballRadius,
          "idle",
          prevX,
          prevY
        )
      : null;
    if (idx != null) {
      state = { phase: "falling", fallMs: 0, activeTrapIndex: idx, respawnPending: false };
    } else {
      return { ...base, state };
    }
  }

  if (state.phase === "falling" && state.activeTrapIndex != null) {
    const tr = traps[state.activeTrapIndex];
    if (!tr) {
      state = initialTrapFallState();
      return { ...base, state };
    }
    state = { ...state, fallMs: state.fallMs + deltaMs };
    const sinkT = clamp(state.fallMs / TRAP_HOLE.fallDurationMs, 0, 1);
    const shouldRespawn = state.fallMs >= TRAP_HOLE.fallDurationMs && !state.respawnPending;
    if (shouldRespawn) {
      state = { phase: "done", fallMs: state.fallMs, activeTrapIndex: state.activeTrapIndex, respawnPending: true };
    }
    return {
      state,
      pullFx: 0,
      pullFy: 0,
      sinkT,
      fallingActive: !shouldRespawn,
      targetX: tr.x,
      targetY: tr.y,
      shouldRespawn
    };
  }

  return { ...base, state };
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
