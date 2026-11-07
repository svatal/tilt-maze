import { describe, expect, it } from "vitest";
import {
  TRAP_HOLE,
  TRAP_TEST_DEFAULTS,
  findTrapCapture,
  initialTrapFallState,
  shouldTrapCapture,
  simulateTrapCenterCrossing,
  stepTrapFall,
  type TrapDef
} from "../src/trapHole";

const BR = TRAP_TEST_DEFAULTS.ballRadius;
const TRAP: TrapDef = { x: 180, y: 320, r: 22 };

describe("shouldTrapCapture — jádro vs. okraj", () => {
  it("střed pasti při herní rychlosti 6", () => {
    expect(shouldTrapCapture(TRAP, TRAP.x + 1, TRAP.y, 6, 0.2, BR, null, null)).toBe(true);
  });

  it("průlet středem smykem (max. rychlost)", () => {
    const prevX = TRAP.x - 28;
    expect(shouldTrapCapture(TRAP, TRAP.x + 2, TRAP.y, 7, 0, BR, prevX, TRAP.y)).toBe(true);
  });

  it("rychlý průlet jen okrajem nemusí chytit", () => {
    const rimY = TRAP.y;
    const rimX = TRAP.x + TRAP.r - 1.5;
    expect(shouldTrapCapture(TRAP, rimX, rimY, 7, 0.3, BR, rimX - 18, rimY)).toBe(false);
  });

  it("mimo dosah pasti nechytí", () => {
    expect(shouldTrapCapture(TRAP, TRAP.x + TRAP.r + 30, TRAP.y, 3, 0, BR, null, null)).toBe(false);
  });
});

describe("findTrapCapture", () => {
  it("chytí míček ve středu při nízké rychlosti", () => {
    const idx = findTrapCapture([TRAP], TRAP.x + 2, TRAP.y, 0.3, 0.1, BR, "idle");
    expect(idx).toBe(0);
  });
});

describe("simulateTrapCenterCrossing — pohyb skrz střed", () => {
  for (const speed of [2.5, 4.5, 6.2, 7]) {
    it(`rychlost ${speed}: zachycení a právě jeden respawn`, () => {
      const sim = simulateTrapCenterCrossing({ trap: TRAP, ballRadius: BR, vx: speed });
      expect(sim.captured, `krok ${sim.captureStep}`).toBe(true);
      expect(sim.respawnCount).toBe(1);
    });
  }

  it("miniaturní delta (8 ms) stále zachytí průlet", () => {
    const sim = simulateTrapCenterCrossing({ trap: TRAP, ballRadius: BR, vx: 6.8, deltaMs: 8 });
    expect(sim.captured).toBe(true);
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
