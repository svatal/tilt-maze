import { describe, expect, it } from "vitest";
import {
  TRAP_HOLE,
  TRAP_TEST_DEFAULTS,
  ballCenterInsideTrapDisk,
  ballPathEntersTrapDisk,
  findTrapCapture,
  initialTrapFallState,
  shouldTrapCapture,
  simulateTrapCenterCrossing,
  simulateTrapChordBothEndsOutside,
  simulateTrapMotion,
  stepTrapFall,
  trapCaptureRadius,
  type TrapDef
} from "../src/trapHole";

const BR = TRAP_TEST_DEFAULTS.ballRadius;
const TRAP: TrapDef = { x: 180, y: 320, r: 22 };

describe("černá díra — geometrie", () => {
  it("platný poloměr = vizuální r", () => {
    expect(trapCaptureRadius(TRAP)).toBe(22);
  });

  it("střed těsně uvnitř okraje disku", () => {
    const x = TRAP.x + TRAP.r - 0.5;
    expect(ballCenterInsideTrapDisk(x, TRAP.y, TRAP)).toBe(true);
  });

  it("střed těsně vně disku", () => {
    const x = TRAP.x + TRAP.r + 0.02;
    expect(ballCenterInsideTrapDisk(x, TRAP.y, TRAP)).toBe(false);
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

describe("shouldTrapCapture — bez ohledu na rychlost", () => {
  for (const speed of [0.2, 4, 7, 12]) {
    it(`rychlost ${speed} u okraje disku`, () => {
      const x = TRAP.x + TRAP.r - 1;
      expect(shouldTrapCapture(TRAP, x, TRAP.y, speed, 0, BR, null, null)).toBe(true);
    });
  }

  it("smyk rychlým průletem skrz disk", () => {
    const prevX = TRAP.x - TRAP.r - 14;
    const x = TRAP.x + TRAP.r + 14;
    expect(shouldTrapCapture(TRAP, x, TRAP.y, 9, 0, BR, prevX, TRAP.y)).toBe(true);
  });

  it("mimo disk nechytí", () => {
    expect(shouldTrapCapture(TRAP, TRAP.x + TRAP.r + 8, TRAP.y, 0, 0, BR, null, null)).toBe(false);
  });
});

describe("simulateTrapMotion — integrace", () => {
  for (const speed of [1.5, 6, 7.2]) {
    it(`průlet středem vx=${speed}`, () => {
      const sim = simulateTrapCenterCrossing({ trap: TRAP, ballRadius: BR, vx: speed });
      expect(sim.captured).toBe(true);
      expect(sim.respawnCount).toBe(1);
    });
  }

  it("delta 8 ms — rychlý smyk", () => {
    const sim = simulateTrapCenterCrossing({ trap: TRAP, ballRadius: BR, vx: 7, deltaMs: 8 });
    expect(sim.captured).toBe(true);
  });

  it("delta 33 ms — velký krok", () => {
    const sim = simulateTrapCenterCrossing({ trap: TRAP, ballRadius: BR, vx: 6, deltaMs: 33 });
    expect(sim.captured).toBe(true);
  });

  it("tětiva s konci vně disku", () => {
    const sim = simulateTrapChordBothEndsOutside({ trap: TRAP, ballRadius: BR, vx: 6.5 });
    expect(sim.captured).toBe(true);
    expect(sim.respawnCount).toBe(1);
  });

  it("vedle disku — žádné spolknutí", () => {
    const sim = simulateTrapMotion({
      trap: TRAP,
      ballRadius: BR,
      vx: 0,
      vy: 5,
      startX: TRAP.x + TRAP.r + 9,
      startY: TRAP.y - 50,
      steps: 40
    });
    expect(sim.captured).toBe(false);
    expect(sim.respawnCount).toBe(0);
  });

  it("vstup z okraje disku (ne jen střed)", () => {
    const sim = simulateTrapMotion({
      trap: TRAP,
      ballRadius: BR,
      vx: 8,
      vy: 0,
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

  it("během pádu vysoká rychlost neukončí pád", () => {
    let state: ReturnType<typeof initialTrapFallState> = {
      phase: "falling",
      fallMs: 40,
      activeTrapIndex: 0,
      respawnPending: false
    };
    const r = stepTrapFall({
      state,
      traps: [TRAP],
      ballX: TRAP.x + 5,
      ballY: TRAP.y,
      vx: 7,
      vy: 6,
      ballRadius: BR,
      deltaMs: 16
    });
    expect(r.state.phase).toBe("falling");
    expect(r.shouldRespawn).toBe(false);
  });

  it("mimo radius žádné síly", () => {
    const r = stepTrapFall({
      state: initialTrapFallState(),
      traps: [TRAP],
      ballX: TRAP.x + TRAP.r + 30,
      ballY: TRAP.y,
      vx: 2,
      vy: 0,
      ballRadius: BR,
      deltaMs: 16
    });
    expect(r.pullFx).toBe(0);
    expect(r.pullFy).toBe(0);
    expect(r.state.phase).toBe("idle");
  });

  it("allowCapture=false", () => {
    const r = stepTrapFall({
      state: initialTrapFallState(),
      traps: [TRAP],
      ballX: TRAP.x,
      ballY: TRAP.y,
      vx: 0,
      vy: 0,
      ballRadius: BR,
      deltaMs: 16,
      allowCapture: false
    });
    expect(r.state.phase).toBe("idle");
  });

  it("findTrapCapture na hranici", () => {
    const idx = findTrapCapture([TRAP], TRAP.x + TRAP.r, TRAP.y, 7, 0, BR, "idle");
    expect(idx).toBe(0);
  });

  expect(TRAP_HOLE.fallDurationMs).toBeLessThan(500);
});
