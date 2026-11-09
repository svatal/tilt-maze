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
    expect(holeLocalTiltMagnitude(R + 0.01, R)).toBe(0);
    expect(holeLocalTilt(121, 100, goal).ax).toBe(0);
  });

  it("na okraji (d=r) maximum ≈ 45°", () => {
    expect(holeLocalTiltAngleDeg(R, R)).toBeCloseTo(45, 5);
    expect(holeLocalTiltMagnitude(R, R)).toBeCloseTo(rimMag, 5);
  });

  it("směrem ke středu úhel klesá monotonně v mezikruhu", () => {
    expect(holeLocalTiltMagnitude(12, R)).toBeLessThan(holeLocalTiltMagnitude(18, R));
  });

  it("u vnitřní hranice mezikruhu (0.25r) je konečný sklon", () => {
    const inner = holeTriggerRadius(R);
    expect(holeLocalTiltMagnitude(inner + 0.02, R)).toBeGreaterThan(0);
    expect(holeLocalTiltMagnitude(inner - 0.02, R)).toBe(0);
  });

  it("ve vnitřní trigger zóně lokální sklon = 0", () => {
    expect(holeLocalTilt(103, 100, goal).ax).toBe(0);
  });
});

describe("trigger zóna 0.25·r", () => {
  it("poloměr trigger = čtvrtina průměru", () => {
    expect(holeTriggerRadius(20)).toBe(5);
    expect(HOLE_TRIGGER_FRAC).toBe(0.25);
  });

  it("na polovině poloměru (0.5r) trigger ne", () => {
    expect(ballCenterTriggersHoleSink(110, 100, goal)).toBe(false);
    expect(ballInHoleSlopeAnnulus(110, 100, goal)).toBe(true);
  });

  it("vnitřní trigger ano", () => {
    expect(ballCenterTriggersHoleSink(104, 100, goal)).toBe(true);
  });

  it("okraj viditelné díry neaktivuje trigger", () => {
    expect(ballCenterTriggersHoleSink(120, 100, goal)).toBe(false);
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
