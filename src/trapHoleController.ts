import Phaser from "phaser";
import {
  TRAP_HOLE,
  initialTrapFallState,
  paintTrapHole,
  stepTrapFall,
  type TrapDef,
  type TrapFallState
} from "./trapHole";

export class TrapHoleController {
  private traps: TrapDef[] = [];
  private state: TrapFallState = initialTrapFallState();
  private gfx: Phaser.GameObjects.Graphics[] = [];
  private ballRadius = 11;
  private onRespawn: (() => void) | null = null;
  private respawnDispatched = false;
  private prevBallX: number | null = null;
  private prevBallY: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  configure(traps: TrapDef[], ballRadius: number, onRespawn: () => void): void {
    this.traps = traps;
    this.ballRadius = ballRadius;
    this.onRespawn = onRespawn;
    this.resetState();
    for (const g of this.gfx) g.destroy();
    this.gfx = traps.map((tr) => {
      const g = this.scene.add.graphics();
      g.setDepth(2);
      paintTrapHole(g, tr, 0);
      return g;
    });
  }

  resetState(): void {
    this.state = initialTrapFallState();
    this.respawnDispatched = false;
    this.prevBallX = null;
    this.prevBallY = null;
    for (let i = 0; i < this.traps.length; i++) {
      const tr = this.traps[i];
      if (tr && this.gfx[i]) paintTrapHole(this.gfx[i], tr, 0);
    }
  }

  cancelFall(): void {
    this.resetState();
  }

  destroy(): void {
    for (const g of this.gfx) g.destroy();
    this.gfx = [];
    this.traps = [];
    this.onRespawn = null;
  }

  isFalling(): boolean {
    return this.state.phase === "falling";
  }

  getSinkT(): number {
    if (this.state.phase !== "falling" && this.state.phase !== "done") return 0;
    return Math.min(1, this.state.fallMs / TRAP_HOLE.fallDurationMs);
  }

  tick(
    bb: MatterJS.BodyType,
    deltaMs: number,
    applyForce: (body: MatterJS.BodyType, force: { x: number; y: number }) => void,
    setVelocity: (body: MatterJS.BodyType, vel: { x: number; y: number }) => void,
    setPosition: (body: MatterJS.BodyType, pos: { x: number; y: number }) => void,
    allowCapture = true
  ): void {
    if (this.traps.length === 0) return;

    const pos = bb.position;
    const result = stepTrapFall({
      state: this.state,
      traps: this.traps,
      ballX: pos.x,
      ballY: pos.y,
      vx: bb.velocity.x,
      vy: bb.velocity.y,
      ballRadius: this.ballRadius,
      deltaMs,
      allowCapture,
      prevBallX: this.prevBallX,
      prevBallY: this.prevBallY
    });

    this.state = result.state;
    this.prevBallX = pos.x;
    this.prevBallY = pos.y;

    if (result.pullFx !== 0 || result.pullFy !== 0) {
      applyForce(bb, { x: result.pullFx, y: result.pullFy });
    }

    if (result.fallingActive && result.targetX != null && result.targetY != null) {
      const nx = pos.x + (result.targetX - pos.x) * TRAP_HOLE.fallLerp;
      const ny = pos.y + (result.targetY - pos.y) * TRAP_HOLE.fallLerp;
      setPosition(bb, { x: nx, y: ny });
      const v = bb.velocity;
      setVelocity(bb, { x: v.x * TRAP_HOLE.fallDamping, y: v.y * TRAP_HOLE.fallDamping });
    }

    const idx = this.state.activeTrapIndex;
    if (idx != null && this.gfx[idx]) {
      const tr = this.traps[idx];
      paintTrapHole(this.gfx[idx], tr, result.sinkT);
    }

    if (result.shouldRespawn && !this.respawnDispatched && this.onRespawn) {
      this.respawnDispatched = true;
      this.onRespawn();
      this.state = initialTrapFallState();
      this.respawnDispatched = false;
      this.prevBallX = null;
      this.prevBallY = null;
    }
  }
}
