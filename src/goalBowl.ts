import { BALL_RADIUS } from "./constants";
import { clamp, computeBowlPull, holeDepth, isShallowGraze, type HoleDef } from "./holeBowl";

/** Parametry mísy cíle — ladění chování vs. rychlost míčku. */
export const GOAL_BOWL = {
  influenceRadiusMul: 1.09,
  captureDepthMul: 0.28,
  settleDepthMul: 0.32,
  fastPassSpeed: 5.4,
  maxSettleEntrySpeed: 5.8,
  settleDurationMs: 460,
  pullScale: 3.15,
  settleDamping: 0.82,
  settleLerp: 0.15
} as const;

export type GoalDef = HoleDef;

export type GoalBowlPhase = "idle" | "approach" | "settling" | "completed";

export type GoalBowlStepInput = {
  phase: GoalBowlPhase;
  settleMs: number;
  completed: boolean;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  goal: GoalDef;
  ballRadius: number;
  deltaMs: number;
};

export type GoalBowlStepResult = {
  phase: GoalBowlPhase;
  settleMs: number;
  completed: boolean;
  shouldWin: boolean;
  pullFx: number;
  pullFy: number;
  sinkT: number;
  settlingActive: boolean;
  targetX: number | null;
  targetY: number | null;
};

export { holeDepth as goalDepth, isShallowGraze };

export function computeBowlPullForGoal(
  ballX: number,
  ballY: number,
  vx: number,
  vy: number,
  goal: GoalDef,
  ballRadius: number,
  phase: GoalBowlPhase
) {
  return computeBowlPull(ballX, ballY, vx, vy, goal, ballRadius, GOAL_BOWL, phase);
}

export function stepGoalBowl(input: GoalBowlStepInput): GoalBowlStepResult {
  const { goal, ballRadius, deltaMs } = input;
  let { phase, settleMs, completed } = input;
  const speed = Math.hypot(input.vx, input.vy);
  const pull = computeBowlPullForGoal(input.ballX, input.ballY, input.vx, input.vy, goal, ballRadius, phase);
  let shouldWin = false;
  let settlingActive = false;
  let targetX: number | null = null;
  let targetY: number | null = null;
  let sinkT = 0;

  if (completed) {
    return {
      phase: "completed",
      settleMs,
      completed: true,
      shouldWin: false,
      pullFx: 0,
      pullFy: 0,
      sinkT: 1,
      settlingActive: false,
      targetX: null,
      targetY: null
    };
  }

  const captureDepth = ballRadius * GOAL_BOWL.captureDepthMul;
  const settleDist = goal.r * GOAL_BOWL.settleDepthMul;

  if (phase === "idle" || phase === "approach") {
    const deepEnough = pull.depth >= captureDepth * 0.65;
    const overHole = pull.dist < goal.r * 0.62 && pull.depth > -ballRadius * 0.15;
    const seatedInRim = pull.dist < goal.r - ballRadius * 0.35;
    if ((deepEnough || overHole || seatedInRim) && speed <= GOAL_BOWL.maxSettleEntrySpeed && !pull.shallow) {
      phase = "settling";
      settleMs = 0;
    } else if (pull.dist < goal.r + ballRadius && pull.depth > -ballRadius * 0.3) {
      phase = "approach";
    } else if (pull.dist > goal.r + ballRadius * 1.1) {
      phase = "idle";
    }
  }

  if (phase === "settling") {
    settlingActive = true;
    targetX = goal.x;
    targetY = goal.y;
    if (pull.dist <= settleDist * 1.4 || pull.depth >= captureDepth * 0.7) {
      settleMs += deltaMs;
    } else if (pull.depth < captureDepth * 0.2 && speed > GOAL_BOWL.fastPassSpeed) {
      phase = "approach";
      settleMs = 0;
      settlingActive = false;
      targetX = null;
      targetY = null;
    }
    sinkT = clamp(settleMs / GOAL_BOWL.settleDurationMs, 0, 1);
    if (settleMs >= GOAL_BOWL.settleDurationMs) {
      phase = "completed";
      completed = true;
      shouldWin = true;
      sinkT = 1;
    }
  }

  const settledPull =
    phase === "settling"
      ? computeBowlPullForGoal(input.ballX, input.ballY, input.vx, input.vy, goal, ballRadius, "settling")
      : pull;

  return {
    phase,
    settleMs,
    completed,
    shouldWin,
    pullFx: settledPull.pullFx,
    pullFy: settledPull.pullFy,
    sinkT,
    settlingActive,
    targetX,
    targetY
  };
}

export function paintGoalBowl(
  g: {
    fillStyle: (c: number, a?: number) => void;
    fillCircle: (x: number, y: number, r: number) => void;
    lineStyle: (w: number, c: number, a?: number) => void;
    strokeCircle: (x: number, y: number, r: number) => void;
    clear: () => void;
  },
  goal: GoalDef,
  sinkT: number
): void {
  g.clear();
  const { x, y, r } = goal;
  g.fillStyle(0x1a120a, 1);
  g.fillCircle(x, y, r + 3);
  const rings = [
    { mul: 1, color: 0x0a2810, alpha: 1 },
    { mul: 0.82, color: 0x0d3d14, alpha: 0.95 },
    { mul: 0.62, color: 0x06220a, alpha: 1 },
    { mul: 0.4, color: 0x021408, alpha: 1 }
  ];
  for (const ring of rings) {
    g.fillStyle(ring.color, ring.alpha);
    const shrink = sinkT * 2.5;
    g.fillCircle(x, y + shrink, r * ring.mul - 1);
  }
  g.lineStyle(2, 0x1a5c28, 0.9);
  g.strokeCircle(x, y, r);
  g.lineStyle(1, 0x3d8f52, 0.35);
  g.strokeCircle(x, y + 1, r * 0.55);
}

export function initialGoalBowlState(): {
  phase: GoalBowlPhase;
  settleMs: number;
  completed: boolean;
} {
  return { phase: "idle", settleMs: 0, completed: false };
}

export const GOAL_TEST_DEFAULTS = {
  ballRadius: BALL_RADIUS
};
