import { describe, expect, it } from "vitest";
import {
  TRAP_HOLE,
  TRAP_TEST_DEFAULTS,
  ballCenterInsideTrapDisk,
  ballPathEntersTrapDisk,
  findTrapCapture,
  initialTrapFallState,
  shouldTrapCapture,
  stepTrapFall,
  type TrapDef
} from "../src/trapCapture";
import {
  simulateTrapCenterCrossing,
  simulateTrapChordBothEndsOutside,
  simulateTrapMotion
} from "./helpers/trapHoleSim";

const BR = TRAP_TEST_DEFAULTS.ballRadius;
const TRAP: TrapDef = { x: 180, y: 320, r: 22 };

describe("černá díra — geometrie", () => {
  it("střed těsně uvnitř okraje disku", () => {
    expect(ballCenterInsideTrapDisk(TRAP.x + TRAP.r - 0.5, TRAP.y, TRAP)).toBe(true);
  });

  it("střed těsně vně disku", () => {
    expect(ballCenterInsideTrapDisk(TRAP.x + TRAP.r + 0.02, TRAP.y, TRAP)).toBe(false);
  });

  it("tětiva oběma konci vně protne disk", () => {
    const left = TRAP.x - TRAP.r - 12;
    const right = TRAP.x + TRAP.r + 12;
    expect(ballPathEntersTrapDisk(TRAP, left, TRAP.y, right, TRAP.y)).toBe(true);
  });

  it("tětiva mimo disk (bez průniku)", () => {
    const x = TRAP.x + TRAP.r + 14;
    expect(ballPathEntersTrapDisk(TRAP, x, TRAP.y - 40, x, TRAP.y + 40)).toBe(false);
  });
});

describe("shouldTrapCapture — libovolná rychlost (geometrie)", () => {
  it("okraj disku", () => {
    const x = TRAP.x + TRAP.r - 1;
    expect(shouldTrapCapture(TRAP, x, TRAP.y, null, null)).toBe(true);
  });

  it("smyk průletem skrz disk", () => {
    const prevX = TRAP.x - TRAP.r - 14;
    const x = TRAP.x + TRAP.r + 14;
    expect(shouldTrapCapture(TRAP, x, TRAP.y, prevX, TRAP.y)).toBe(true);
  });

  it("mimo disk nechytí", () => {
    expect(shouldTrapCapture(TRAP, TRAP.x + TRAP.r + 8, TRAP.y, null, null)).toBe(false);
  });
});

describe("simulateTrapMotion (helpers)", () => {
  for (const speed of [1.5, 6, 7.2]) {
    it(`průlet středem vx=${speed}`, () => {
      const sim = simulateTrapCenterCrossing({ trap: TRAP, ballRadius: BR, vx: speed });
      expect(sim.captured).toBe(true);
      expect(sim.respawnCount).toBe(1);
    });
  }

  it("delta 8 ms a 33 ms", () => {
    expect(simulateTrapCenterCrossing({ trap: TRAP, ballRadius: BR, vx: 7, deltaMs: 8 }).captured).toBe(true);
    expect(simulateTrapCenterCrossing({ trap: TRAP, ballRadius: BR, vx: 6, deltaMs: 33 }).captured).toBe(true);
  });

  it("tětiva s konci vně disku", () => {
    const sim = simulateTrapChordBothEndsOutside({ trap: TRAP, vx: 6.5 });
    expect(sim.captured).toBe(true);
    expect(sim.respawnCount).toBe(1);
  });

  it("vedle disku bez spolknutí", () => {
    const sim = simulateTrapMotion({
      trap: TRAP,
      vx: 0,
      vy: 5,
      startX: TRAP.x + TRAP.r + 9,
      startY: TRAP.y - 50,
      steps: 40
    });
    expect(sim.captured).toBe(false);
  });

  it("vstup z okraje disku", () => {
    const sim = simulateTrapMotion({
      trap: TRAP,
      vx: 8,
      startX: TRAP.x + TRAP.r - 1.5,
      startY: TRAP.y,
      steps: 8
    });
    expect(sim.captured).toBe(true);
  });
});

describe("stepTrapFall — pád a respawn", () => {
  it("po době pádu jeden respawn", () => {
    let state = initialTrapFallState();
    state = { phase: "falling", fallMs: 0, activeTrapIndex: 0 };
    let respawns = 0;
    for (let i = 0; i < 30; i++) {
      const r = stepTrapFall({
        state,
        traps: [TRAP],
        ballX: TRAP.x,
        ballY: TRAP.y,
        deltaMs: 20
      });
      state = r.state;
      if (r.shouldRespawn) {
        respawns += 1;
        break;
      }
    }
    expect(respawns).toBe(1);
  });

  it("během pádu žádné vnější síly ve výsledku", () => {
    const r = stepTrapFall({
      state: { phase: "falling", fallMs: 40, activeTrapIndex: 0 },
      traps: [TRAP],
      ballX: TRAP.x + 5,
      ballY: TRAP.y,
      deltaMs: 16
    });
    expect(r.state.phase).toBe("falling");
    expect(r.fallingActive).toBe(true);
    expect(r.shouldRespawn).toBe(false);
  });

  it("mimo radius zůstane idle", () => {
    const r = stepTrapFall({
      state: initialTrapFallState(),
      traps: [TRAP],
      ballX: TRAP.x + TRAP.r + 30,
      ballY: TRAP.y,
      deltaMs: 16
    });
    expect(r.state.phase).toBe("idle");
  });

  it("allowCapture=false", () => {
    const r = stepTrapFall({
      state: initialTrapFallState(),
      traps: [TRAP],
      ballX: TRAP.x,
      ballY: TRAP.y,
      deltaMs: 16,
      allowCapture: false
    });
    expect(r.state.phase).toBe("idle");
  });

  it("findTrapCapture na hranici", () => {
    expect(findTrapCapture([TRAP], TRAP.x + TRAP.r, TRAP.y, "idle")).toBe(0);
  });

  it("délka pádu", () => {
    expect(TRAP_HOLE.fallDurationMs).toBeLessThan(500);
  });
});
