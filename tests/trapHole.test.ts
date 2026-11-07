import { describe, expect, it } from "vitest";
import {
  TRAP_HOLE,
  TRAP_TEST_DEFAULTS,
  findTrapCapture,
  initialTrapFallState,
  stepTrapFall,
  type TrapDef
} from "../src/trapHole";

const BR = TRAP_TEST_DEFAULTS.ballRadius;
const TRAP: TrapDef = { x: 180, y: 320, r: 22 };

describe("findTrapCapture", () => {
  it("chytí míček hluboko v pasti při nízké rychlosti", () => {
    const idx = findTrapCapture([TRAP], TRAP.x + 2, TRAP.y, 0.3, 0.1, BR, "idle");
    expect(idx).toBe(0);
  });

  it("rychlý průlet okrajem neaktivuje past", () => {
    const idx = findTrapCapture([TRAP], TRAP.x + TRAP.r - 2, TRAP.y, 7, 0, BR, "idle");
    expect(idx).toBeNull();
  });
});

describe("stepTrapFall — jedna respawn událost", () => {
  it("po době pádu vyvolá přesně jednou shouldRespawn", () => {
    let state = initialTrapFallState();
    state = { phase: "falling", fallMs: 0, activeTrapIndex: 0, respawnPending: false };
    let respawns = 0;
    for (let i = 0; i < 30; i++) {
      const r = stepTrapFall({
        state,
        traps: [TRAP],
        ballX: TRAP.x,
        ballY: TRAP.y,
        vx: 0,
        vy: 0,
        ballRadius: BR,
        deltaMs: 20
      });
      state = r.state;
      if (r.shouldRespawn) respawns += 1;
    }
    expect(respawns).toBe(1);
  });

  it("během pádu nelze spustit druhou past", () => {
    let state: ReturnType<typeof initialTrapFallState> = {
      phase: "falling",
      fallMs: 50,
      activeTrapIndex: 0,
      respawnPending: false
    };
    const other: TrapDef = { x: 50, y: 50, r: 15 };
    const r = stepTrapFall({
      state,
      traps: [TRAP, other],
      ballX: other.x,
      ballY: other.y,
      vx: 0,
      vy: 0,
      ballRadius: BR,
      deltaMs: 16
    });
    expect(r.state.activeTrapIndex).toBe(0);
    expect(r.shouldRespawn).toBe(false);
  });
});

describe("stepTrapFall — reset při idle", () => {
  it("allowCapture=false nezačne pád", () => {
    const r = stepTrapFall({
      state: initialTrapFallState(),
      traps: [TRAP],
      ballX: TRAP.x,
      ballY: TRAP.y,
      vx: 0.2,
      vy: 0,
      ballRadius: BR,
      deltaMs: 16,
      allowCapture: false
    });
    expect(r.state.phase).toBe("idle");
    expect(r.shouldRespawn).toBe(false);
  });

  it("po resetu stavu lze znovu spadnout", () => {
    const fresh = initialTrapFallState();
    expect(fresh.phase).toBe("idle");
    expect(fresh.fallMs).toBe(0);
    expect(TRAP_HOLE.fallDurationMs).toBeLessThan(500);
  });
});
