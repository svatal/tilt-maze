import Phaser from "phaser";
import {
  GOAL_BOWL,
  initialGoalBowlState,
  paintGoalBowl,
  stepGoalBowl,
  type GoalBowlPhase,
  type GoalDef
} from "./goalBowl";

export class GoalBowlController {
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private goal: GoalDef | null = null;
  private phase: GoalBowlPhase = "idle";
  private settleMs = 0;
  private completed = false;
  private sinkT = 0;
  private ballRadius = 11;
  private onWin: (() => void) | null = null;
  private winDispatched = false;

  constructor(private readonly scene: Phaser.Scene) {}

  configure(goal: GoalDef, ballRadius: number, onWin: () => void): void {
    this.goal = goal;
    this.ballRadius = ballRadius;
    this.onWin = onWin;
    this.resetState();
    this.gfx?.destroy();
    this.gfx = this.scene.add.graphics();
    this.gfx.setDepth(2);
    paintGoalBowl(this.gfx, goal, 0);
  }

  resetState(): void {
    const s = initialGoalBowlState();
    this.phase = s.phase;
    this.settleMs = s.settleMs;
    this.completed = s.completed;
    this.sinkT = 0;
    this.winDispatched = false;
  }

  destroy(): void {
    this.gfx?.destroy();
    this.gfx = null;
    this.goal = null;
    this.onWin = null;
  }

  isSettling(): boolean {
    return this.phase === "settling";
  }

  getSinkT(): number {
    return this.sinkT;
  }

  tick(
    bb: MatterJS.BodyType,
    deltaMs: number,
    applyForce: (body: MatterJS.BodyType, force: { x: number; y: number }) => void,
    setVelocity: (body: MatterJS.BodyType, vel: { x: number; y: number }) => void,
    setPosition: (body: MatterJS.BodyType, pos: { x: number; y: number }) => void
  ): void {
    if (!this.goal || this.winDispatched) return;

    const pos = bb.position;
    const vx = bb.velocity.x;
    const vy = bb.velocity.y;

    const result = stepGoalBowl({
      phase: this.phase,
      settleMs: this.settleMs,
      completed: this.completed,
      ballX: pos.x,
      ballY: pos.y,
      vx,
      vy,
      goal: this.goal,
      ballRadius: this.ballRadius,
      deltaMs
    });

    this.phase = result.phase;
    this.settleMs = result.settleMs;
    this.completed = result.completed;
    this.sinkT = result.sinkT;

    if (result.pullFx !== 0 || result.pullFy !== 0) {
      applyForce(bb, { x: result.pullFx, y: result.pullFy });
    }

    if (result.settlingActive && result.targetX != null && result.targetY != null) {
      const lerp = GOAL_BOWL.settleLerp;
      const nx = pos.x + (result.targetX - pos.x) * lerp;
      const ny = pos.y + (result.targetY - pos.y) * lerp;
      setPosition(bb, { x: nx, y: ny });
      const v = bb.velocity;
      setVelocity(bb, {
        x: v.x * GOAL_BOWL.settleDamping,
        y: v.y * GOAL_BOWL.settleDamping
      });
    }

    if (this.goal && this.gfx) {
      paintGoalBowl(this.gfx, this.goal, this.sinkT);
    }

    if (result.shouldWin && !this.winDispatched && this.onWin) {
      this.winDispatched = true;
      this.onWin();
    }
  }
}
