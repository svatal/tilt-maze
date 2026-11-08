import { initialTrapFallState, stepTrapFall, type TrapDef } from "../../src/trapCapture";

export type TrapCrossSimResult = {
  captured: boolean;
  respawnCount: number;
  captureStep: number | null;
};

export type TrapMotionSimOpts = {
  trap: TrapDef;
  vx: number;
  vy?: number;
  steps?: number;
  deltaMs?: number;
  startX: number;
  startY: number;
};

/** Integrační simulace pohybu středu míčku + stepTrapFall (pouze testy). */
export function simulateTrapMotion(opts: TrapMotionSimOpts): TrapCrossSimResult {
  const { trap, vx, vy = 0, steps = 48, deltaMs = 16, startX, startY } = opts;
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
      deltaMs,
      prevBallX: prevX,
      prevBallY: prevY
    });
    state = r.state;
    if (r.shouldRespawn) {
      respawnCount += 1;
      x = trap.x + trap.r + 40;
      y = trap.y - 200;
      prevX = null;
      prevY = null;
    }
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

export function simulateTrapCenterCrossing(opts: {
  trap: TrapDef;
  vx: number;
  vy?: number;
  steps?: number;
  deltaMs?: number;
  startOffsetX?: number;
  ballRadius?: number;
}): TrapCrossSimResult {
  const startOffsetX = opts.startOffsetX ?? -(opts.trap.r + (opts.ballRadius ?? 11) + 8);
  return simulateTrapMotion({
    trap: opts.trap,
    vx: opts.vx,
    vy: opts.vy,
    steps: opts.steps,
    deltaMs: opts.deltaMs,
    startX: opts.trap.x + startOffsetX,
    startY: opts.trap.y
  });
}

export function simulateTrapChordBothEndsOutside(opts: {
  trap: TrapDef;
  vx: number;
  deltaMs?: number;
}): TrapCrossSimResult {
  const half = opts.trap.r + 18;
  return simulateTrapMotion({
    trap: opts.trap,
    vx: opts.vx,
    deltaMs: opts.deltaMs,
    steps: 56,
    startX: opts.trap.x - half,
    startY: opts.trap.y
  });
}
