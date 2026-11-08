import { describe, expect, it } from "vitest";
import {
  HOLE_TRIGGER_FRAC,
  ballCenterInVisibleHole,
  ballCenterTriggersHoleSink,
  ballInHoleSlopeAnnulus,
  composeBoardAndHoleTilts,
  holeLocalTilt,
  holeTriggerRadius,
  type HoleDef
} from "../src/holeSlope";

const goal: HoleDef = { cx: 100, cy: 100, r: 20 };

describe("trigger zóna 0.5·r", () => {
  it("poloměr trigger = polovina viditelné díry", () => {
    expect(holeTriggerRadius(20)).toBe(10);
    expect(HOLE_TRIGGER_FRAC).toBe(0.5);
  });

  it("okraj viditelné díry (dist=r) neaktivuje trigger", () => {
    expect(ballCenterTriggersHoleSink(120, 100, goal)).toBe(false);
  });

  it("vnitřní trigger ano", () => {
    expect(ballCenterTriggersHoleSink(105, 100, goal)).toBe(true);
  });

  it("mimo díru ne", () => {
    expect(ballCenterTriggersHoleSink(130, 100, goal)).toBe(false);
  });
});

describe("mezikruh sklonu", () => {
  it("v mezikruhu lokální síla směrem ke středu", () => {
    const v = holeLocalTilt(115, 100, goal);
    expect(v.ax).toBeLessThan(0);
    expect(Math.hypot(v.ax, v.ay)).toBeGreaterThan(0.05);
  });

  it("ve trigger zóně žádný lokální sklon", () => {
    expect(holeLocalTilt(105, 100, goal).ax).toBe(0);
  });

  it("mimo díru nula", () => {
    expect(holeLocalTilt(50, 50, goal).ax).toBe(0);
  });

  it("annulus helper", () => {
    expect(ballInHoleSlopeAnnulus(115, 100, goal)).toBe(true);
    expect(ballInHoleSlopeAnnulus(105, 100, goal)).toBe(false);
    expect(ballInHoleSlopeAnnulus(130, 100, goal)).toBe(false);
  });
});

describe("composeBoardAndHoleTilts", () => {
  it("přičítá sklon jen v mezikruhu", () => {
    const c = composeBoardAndHoleTilts(0.4, 0.1, 115, 100, goal, []);
    const local = holeLocalTilt(115, 100, goal);
    expect(c.ax).toBeCloseTo(0.4 + local.ax, 5);
  });

  it("ve trigger zóně jen board", () => {
    const c = composeBoardAndHoleTilts(0.4, 0.1, 105, 100, goal, []);
    expect(c.ax).toBe(0.4);
    expect(c.ay).toBe(0.1);
  });
});

describe("viditelná díra", () => {
  it("střed na okraji kruhu je uvnitř", () => {
    expect(ballCenterInVisibleHole(120, 100, goal)).toBe(true);
  });
});
