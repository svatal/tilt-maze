import { describe, expect, it } from "vitest";
import {
  GOAL_BOWL,
  GOAL_TEST_DEFAULTS,
  computeBowlPullForGoal,
  goalDepth,
  initialGoalBowlState,
  isShallowGraze,
  stepGoalBowl,
  type GoalDef
} from "../src/goalBowl";

const GOAL: GoalDef = { x: 300, y: 80, r: 26 };
const BR = GOAL_TEST_DEFAULTS.ballRadius;

describe("goalDepth", () => {
  it("je kladná u středu v díře", () => {
    expect(goalDepth(5, GOAL.r, BR)).toBeGreaterThan(0);
  });

  it("je záporná u okraje", () => {
    expect(goalDepth(GOAL.r, GOAL.r, BR)).toBeLessThan(0);
  });
});

describe("mělké ojetí", () => {
  it("rychlý průlet u okraje = shallow", () => {
    const depth = goalDepth(GOAL.r - 1, GOAL.r, BR);
    expect(isShallowGraze(depth, GOAL_BOWL.fastPassSpeed, BR, GOAL_BOWL.fastPassSpeed)).toBe(true);
  });

  it("pomalý vstup hluboko není shallow", () => {
    const depth = goalDepth(8, GOAL.r, BR);
    expect(isShallowGraze(depth, 0.5, BR, GOAL_BOWL.fastPassSpeed)).toBe(false);
  });
});

describe("computeBowlPullForGoal", () => {
  it("mimo dosah = nulová síla", () => {
    const p = computeBowlPullForGoal(10, 10, 0, 0, GOAL, BR, "idle");
    expect(p.pullFx).toBe(0);
    expect(p.pullFy).toBe(0);
  });

  it("v centru díry tahne ke středu", () => {
    const p = computeBowlPullForGoal(GOAL.x + 4, GOAL.y + 2, 0.2, 0.1, GOAL, BR, "approach");
    expect(p.pullFx).toBeLessThan(0);
    expect(Math.hypot(p.pullFx, p.pullFy)).toBeGreaterThan(0);
  });
});

describe("stepGoalBowl — usazení a výhra", () => {
  it("hluboký pomalý míček přejde do settling a jednou vyhraje", () => {
    let phase = initialGoalBowlState().phase;
    let settleMs = 0;
    let completed = false;
    let wins = 0;
    const x = GOAL.x + 3;
    const y = GOAL.y + 1;

    for (let i = 0; i < 80; i++) {
      const r = stepGoalBowl({
        phase,
        settleMs,
        completed,
        ballX: x,
        ballY: y,
        vx: 0.4,
        vy: 0.2,
        goal: GOAL,
        ballRadius: BR,
        deltaMs: 60
      });
      phase = r.phase;
      settleMs = r.settleMs;
      completed = r.completed;
      if (r.shouldWin) wins += 1;
    }
    expect(wins).toBe(1);
    expect(completed).toBe(true);
  });

  it("rychlý průlet u okraje nedokončí level", () => {
    let phase = initialGoalBowlState().phase;
    let settleMs = 0;
    let completed = false;
    let wins = 0;
    const distEdge = GOAL.r - 1;
    const x = GOAL.x + distEdge;
    const y = GOAL.y;

    for (let i = 0; i < 40; i++) {
      const r = stepGoalBowl({
        phase,
        settleMs,
        completed,
        ballX: x + i * 2.5,
        ballY: y,
        vx: 6.5,
        vy: 0.2,
        goal: GOAL,
        ballRadius: BR,
        deltaMs: 16
      });
      phase = r.phase;
      settleMs = r.settleMs;
      completed = r.completed;
      if (r.shouldWin) wins += 1;
    }
    expect(wins).toBe(0);
  });

  it("po resetu stavu lze znovu vyhrát", () => {
    const reset = initialGoalBowlState();
    expect(reset.completed).toBe(false);
    expect(reset.phase).toBe("idle");
  });
});

describe("stepGoalBowl — duplicitní výhra", () => {
  it("ve fázi completed už nevyhrává", () => {
    const r = stepGoalBowl({
      phase: "completed",
      settleMs: GOAL_BOWL.settleDurationMs,
      completed: true,
      ballX: GOAL.x,
      ballY: GOAL.y,
      vx: 0,
      vy: 0,
      goal: GOAL,
      ballRadius: BR,
      deltaMs: 16
    });
    expect(r.shouldWin).toBe(false);
  });
});
