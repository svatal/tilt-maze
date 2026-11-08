import Phaser from "phaser";
import {
  TRAP_HOLE,
  initialTrapFallState,
  paintTrapHole,
  stepTrapFall,
  type TrapDef,
  type TrapFallState
} from "./trapHole";

type MatterBodyOps = {
  setVelocity: (body: MatterJS.BodyType, vel: { x: number; y: number }) => void;
  setPosition: (body: MatterJS.BodyType, pos: { x: number; y: number }) => void;
};

export class TrapHoleController {
  private traps: TrapDef[] = [];
  private state: TrapFallState = initialTrapFallState();
  private gfx: Phaser.GameObjects.Graphics[] = [];
  private onRespawn: (() => void) | null = null;
  private respawnDispatched = false;
  private prevBallX: number | null = null;
  private prevBallY: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  configure(traps: TrapDef[], onRespawn: () => void): void {
    this.traps = traps;
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

  /** Poslední známá poloha středu před fyzikálním krokem (smyk / černá díra). */
  seedMotionSample(x: number, y: number): void {
    this.prevBallX = x;
    this.prevBallY = y;
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
    if (this.state.phase !== "falling") return 0;
    return Math.min(1, this.state.fallMs / TRAP_HOLE.fallDurationMs);
  }

  tick(bb: MatterJS.BodyType, deltaMs: number, ops: MatterBodyOps, allowCapture = true): void {
    if (this.traps.length === 0) return;

    const pos = bb.position;
    const result = stepTrapFall({
      state: this.state,
      traps: this.traps,
      ballX: pos.x,
      ballY: pos.y,
      deltaMs,
      allowCapture,
      prevBallX: this.prevBallX,
      prevBallY: this.prevBallY
    });

    this.state = result.state;
    this.prevBallX = pos.x;
    this.prevBallY = pos.y;

    if (result.fallingActive && result.sinkCenterX != null && result.sinkCenterY != null) {
      const nx = pos.x + (result.sinkCenterX - pos.x) * TRAP_HOLE.fallLerp;
      const ny = pos.y + (result.sinkCenterY - pos.y) * TRAP_HOLE.fallLerp;
      ops.setPosition(bb, { x: nx, y: ny });
      ops.setVelocity(bb, { x: 0, y: 0 });
    }

    const idx = this.state.activeTrapIndex;
    if (idx != null && this.gfx[idx]) {
      paintTrapHole(this.gfx[idx], this.traps[idx], result.sinkT);
    }

    if (result.shouldRespawn && !this.respawnDispatched && this.onRespawn) {
      this.respawnDispatched = true;
      this.onRespawn();
      this.resetState();
    }
  }
}
