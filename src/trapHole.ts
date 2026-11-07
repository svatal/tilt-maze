import { BALL_RADIUS } from "./constants";
import { clamp, computeBowlPull, holeDepth, isShallowGraze, type HoleDef } from "./holeBowl";

export const TRAP_HOLE = {
  influenceRadiusMul: 1.06,
  /** Poloměr jádra pasti (zlomek r) — vstup = okamžitý pád, ne pomalé usazení jako u cíle. */
  coreRadiusMul: 0.72,
  /** Smykový průlet okrajem — stejný princip jako u cíle. */
  fastPassSpeed: 5.4,
  /** Horní rychlost hry (Matter jednotky, MAX_SPEED ve scéně ≈ 7). */
  maxCaptureSpeed: 7.6,
  fallDurationMs: 280,
  pullScale: 1.15,
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

/** Vzdálenost bodu od úsečky (px,py)–(qx,qy). */
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

/**
 * Měl by spadnout do pasti? Jádro díry / průlet smykem — i při herní rychlosti.
 * Mělké rychlé ojetí okraje zůstává mimo.
 */
export function shouldTrapCapture(
  trap: TrapDef,
  ballX: number,
  ballY: number,
  vx: number,
  vy: number,
  ballRadius: number,
  prevX: number | null,
  prevY: number | null
): boolean {
  const d = Math.hypot(ballX - trap.x, ballY - trap.y);
  const depth = holeDepth(d, trap.r, ballRadius);
  const speed = Math.hypot(vx, vy);
  const shallow = isShallowGraze(depth, speed, ballRadius, TRAP_HOLE.fastPassSpeed);
  const coreR = trap.r * TRAP_HOLE.coreRadiusMul;

  const onOuterRim =
    d > trap.r - ballRadius * 0.35 && depth < ballRadius * 0.2 && d < trap.r + ballRadius * 0.45;
  if ((shallow || onOuterRim) && speed >= TRAP_HOLE.fastPassSpeed * 0.88) {
    return false;
  }

  if (speed > TRAP_HOLE.maxCaptureSpeed) return false;

  const inCore = d <= coreR;
  let sweptCore = false;
  if (prevX != null && prevY != null) {
    const travel = Math.hypot(ballX - prevX, ballY - prevY);
    if (travel > 0.4) {
      const closest = distancePointToSegment(trap.x, trap.y, prevX, prevY, ballX, ballY);
      sweptCore = closest <= coreR * 0.95;
    }
  }

  return inCore || sweptCore;
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

/** Integrační simulace: míček projíždí středem pasti po úsečce (jako v update smyku). */
export function simulateTrapCenterCrossing(opts: {
  trap: TrapDef;
  ballRadius: number;
  vx: number;
  vy?: number;
  steps?: number;
  deltaMs?: number;
  startOffsetX?: number;
}): TrapCrossSimResult {
  const {
    trap,
    ballRadius,
    vx,
    vy = 0,
    steps = 48,
    deltaMs = 16,
    startOffsetX = -(trap.r + ballRadius + 8)
  } = opts;
  let state = initialTrapFallState();
  let x = trap.x + startOffsetX;
  let y = trap.y;
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
      prevBallY: prevY
    });
    state = r.state;
    if (r.shouldRespawn) respawnCount += 1;
    if (r.state.phase === "falling" && !captured) {
      captured = true;
      captureStep = step;
    }
    prevX = x;
    prevY = y;
    x += vx * frameScale;
    y += vy * frameScale;
  }
  return { captured, respawnCount, captureStep };
}

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
          ballRadius,
          "idle",
          prevX,
          prevY
        )
      : null;
    if (idx != null) {
      state = { phase: "falling", fallMs: 0, activeTrapIndex: idx, respawnPending: false };
    } else {
      for (const tr of traps) {
        const p = computeBowlPull(input.ballX, input.ballY, input.vx, input.vy, tr, ballRadius, TRAP_HOLE, "idle");
        if (p.shallow) continue;
        if (p.dist > tr.r + ballRadius * 0.45) continue;
        if (p.depth <= -ballRadius * 0.2) continue;
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
