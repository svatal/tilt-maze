import { describe, expect, it } from "vitest";
import {
  HOLE_RIM_ANGLE_DEG,
  HOLE_TRIGGER_FRAC,
  TILT_SIN_SCALE,
  ballCenterInVisibleHole,
  ballCenterTriggersHoleSink,
  ballInHoleSlopeAnnulus,
  composeBoardAndHoleTilts,
  holeLocalTilt,
  holeLocalTiltAngleDeg,
  holeLocalTiltMagnitude,
  holeTriggerRadius,
  type HoleDef
} from "../src/holeSlope";

const goal: HoleDef = { cx: 100, cy: 100, r: 20 };
const R = goal.r;

const rimMag = TILT_SIN_SCALE * Math.sin((HOLE_RIM_ANGLE_DEG * Math.PI) / 180);

describe("radiální profil θ = θ_rim · (d/r)", () => {
  it("těsně mimo díru → 0", () => {
    expect(holeLocalTiltAngleDeg(R + 0.01, R)).toBe(0);
    expect(holeLocalTiltMagnitude(R + 0.01, R)).toBe(0);
    expect(holeLocalTilt(121, 100, goal).ax).toBe(0);
  });

  it("na okraji (d=r) maximum ≈ 45°", () => {
    expect(holeLocalTiltAngleDeg(R, R)).toBeCloseTo(45, 5);
    expect(holeLocalTiltMagnitude(R, R)).toBeCloseTo(rimMag, 5);
  });

  it("skok přes okraj: z nuly na maximum", () => {
    expect(holeLocalTiltMagnitude(R + 0.001, R)).toBe(0);
    expect(holeLocalTiltMagnitude(R - 0.001, R)).toBeCloseTo(rimMag * ((R - 0.001) / R), 4);
  });

  it("směrem ke středu úhel klesá monotonně", () => {
    const dOut = 18;
    const dIn = 12;
    expect(holeLocalTiltMagnitude(dIn, R)).toBeLessThan(holeLocalTiltMagnitude(dOut, R));
    expect(holeLocalTiltAngleDeg(dIn, R)).toBeLessThan(holeLocalTiltAngleDeg(dOut, R));
  });

  it("u vnitřní hranice mezikruhu (0.5r) konečná nenulová, ale slabší než okraj", () => {
    const inner = holeTriggerRadius(R);
    expect(holeLocalTiltAngleDeg(inner + 0.01, R)).toBeCloseTo(45 * ((inner + 0.01) / R), 4);
    expect(holeLocalTiltMagnitude(inner + 0.01, R)).toBeLessThan(rimMag);
  });

  it("ve vnitřní trigger zóně lokální sklon = 0", () => {
    expect(holeLocalTiltAngleDeg(8, R)).toBe(0);
    expect(holeLocalTilt(105, 100, goal).ax).toBe(0);
  });

  it("směr do středu díry", () => {
    const v = holeLocalTilt(119, 100, goal);
    expect(v.ax).toBeLessThan(0);
    expect(Math.abs(v.ay)).toBeLessThan(0.02);
  });
});

describe("trigger zóna 0.5·r", () => {
  it("poloměr trigger = polovina viditelné díry", () => {
    expect(holeTriggerRadius(20)).toBe(10);
    expect(HOLE_TRIGGER_FRAC).toBe(0.5);
  });

  it("okraj viditelné díry neaktivuje trigger", () => {
    expect(ballCenterTriggersHoleSink(120, 100, goal)).toBe(false);
  });

  it("vnitřní trigger ano", () => {
    expect(ballCenterTriggersHoleSink(105, 100, goal)).toBe(true);
  });
});

describe("composeBoardAndHoleTilts", () => {
  it("přičítá lokální příspěvek v mezikruhu", () => {
    const c = composeBoardAndHoleTilts(0.4, 0.1, 115, 100, goal, []);
    const local = holeLocalTilt(115, 100, goal);
    expect(c.ax).toBeCloseTo(0.4 + local.ax, 5);
  });
});

describe("viditelná díra", () => {
  it("střed na okraji kruhu je uvnitř", () => {
    expect(ballCenterInVisibleHole(120, 100, goal)).toBe(true);
    expect(ballInHoleSlopeAnnulus(120, 100, goal)).toBe(true);
  });
});
