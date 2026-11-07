import { BALL_RADIUS } from "./constants";
import { clamp, computeBowlPull, holeDepth, type HoleDef } from "./holeBowl";

export const TRAP_HOLE = {
  influenceRadiusMul: 1.08,
  captureDepthMul: 0.3,
  fastPassSpeed: 5.4,
  maxEntrySpeed: 3.4,
  fallDurationMs: 280,
  pullScale: 0.88,
  fallDamping: 0.78,
  fallLerp: 0.18,
  maxShrink: 0.38
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

export function findTrapCapture(
  traps: TrapDef[],
  ballX: number,
  ballY: number,
  vx: number,
  vy: number,
  ballRadius: number,
  phase: TrapFallPhase
): number | null {
  if (phase !== "idle" || traps.length === 0) return null;
  const speed = Math.hypot(vx, vy);
  const captureDepth = ballRadius * TRAP_HOLE.captureDepthMul;
  let best: { i: number; depth: number } | null = null;

  for (let i = 0; i < traps.length; i++) {
    const tr = traps[i];
    const d = Math.hypot(ballX - tr.x, ballY - tr.y);
    const depth = holeDepth(d, tr.r, ballRadius);
    const pull = computeBowlPull(ballX, ballY, vx, vy, tr, ballRadius, TRAP_HOLE, "approach");
    if (
      depth >= captureDepth * 0.85 &&
      speed <= TRAP_HOLE.maxEntrySpeed &&
      !pull.shallow &&
      d < tr.r + ballRadius * 0.55
    ) {
      if (!best || depth > best.depth) best = { i, depth };
    }
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

export function stepTrapFall(input: TrapFallStepInput): TrapFallStepResult {
  let { state } = input;
  const { traps, ballRadius, deltaMs } = input;
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

  if (state.phase === "idle") {
    const idx = allowCapture
      ? findTrapCapture(traps, input.ballX, input.ballY, input.vx, input.vy, ballRadius, "idle")
      : null;
    if (idx != null) {
      state = { phase: "falling", fallMs: 0, activeTrapIndex: idx, respawnPending: false };
    } else {
      for (const tr of traps) {
        const p = computeBowlPull(input.ballX, input.ballY, input.vx, input.vy, tr, ballRadius, TRAP_HOLE, "idle");
        if (p.shallow) continue;
        if (p.depth <= -ballRadius * 0.12) continue;
        if (p.pullFx !== 0 || p.pullFy !== 0) {
          base.pullFx += p.pullFx;
          base.pullFy += p.pullFy;
        }
      }
      return { ...base, state };
    }
  }

  if (state.phase === "falling" && state.activeTrapIndex != null) {
    const tr = traps[state.activeTrapIndex];
    if (!tr) {
      state = initialTrapFallState();
      return { ...base, state };
    }
    const pull = computeBowlPull(input.ballX, input.ballY, input.vx, input.vy, tr, ballRadius, TRAP_HOLE, "falling");
    state = { ...state, fallMs: state.fallMs + deltaMs };
    const sinkT = clamp(state.fallMs / TRAP_HOLE.fallDurationMs, 0, 1);
    const shouldRespawn = state.fallMs >= TRAP_HOLE.fallDurationMs && !state.respawnPending;
    if (shouldRespawn) {
      state = { phase: "done", fallMs: state.fallMs, activeTrapIndex: state.activeTrapIndex, respawnPending: true };
    }
    return {
      state,
      pullFx: pull.pullFx,
      pullFy: pull.pullFy,
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
