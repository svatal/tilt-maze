import { describe, expect, it } from "vitest";
import {
  HOLE_TRIGGER_FRAC,
  holeLocalTilt,
  holeTriggerRadius
} from "../src/holeSlope";
import {
  MAX_FLOOR_HEIGHT_GRAD,
  bowlCircularAmplitude,
  composeBoardAndFloorTilts,
  featureHeightAt,
  floorHeightAt,
  floorHeightGradient,
  floorHeightTilt,
  maxFloorHeightGradientMagnitude,
  pitFeaturesFromHoles,
  rampRiseForBand,
  type FloorBowlCircle,
  type FloorPit,
  type FloorRamp
} from "../src/floorHeight";
import { levelTerrainFeatures } from "../src/levelFloor";
import { LEVELS } from "../src/levels";

const basin: FloorBowlCircle = {
  shape: "bowl",
  cx: 180,
  cy: 320,
  r: 50,
  amplitude: -bowlCircularAmplitude(50)
};
const hill: FloorBowlCircle = {
  shape: "bowl",
  cx: 180,
  cy: 320,
  r: 50,
  amplitude: bowlCircularAmplitude(50)
};

const rampBand = 40;
const ramp: FloorRamp = {
  shape: "ramp",
  axis: "horizontal",
  split: 220,
  band: rampBand,
  hLow: 0,
  hHigh: rampRiseForBand(rampBand),
  lowSide: "top"
};

describe("floorHeight", () => {
  it("součet výšek z features", () => {
    expect(floorHeightAt(180, 320, [])).toBe(0);
    expect(featureHeightAt(180, 320, basin)).toBe(-bowlCircularAmplitude(50));
    expect(featureHeightAt(180, 320, hill)).toBe(bowlCircularAmplitude(50));
  });

  it("jamka: gradient směřuje ke středu (tilt dolů do jamky)", () => {
    const t = floorHeightTilt(228, 320, [basin]);
    expect(t.ax).toBeLessThan(0);
    expect(Math.hypot(t.ax, t.ay)).toBeGreaterThan(0.12);
  });

  it("kopec: opačný směr než jamka", () => {
    const b = floorHeightTilt(210, 330, [basin]);
    const h = floorHeightTilt(210, 330, [hill]);
    expect(Math.sign(b.ax)).toBe(-Math.sign(h.ax) || (b.ax === 0 && h.ax === 0));
  });

  it("stupňová rampa: dvě rovinné nástupnice přes celou šířku", () => {
    expect(featureHeightAt(20, 120, ramp)).toBe(0);
    expect(featureHeightAt(340, 120, ramp)).toBe(0);
    expect(featureHeightAt(20, 400, ramp)).toBe(rampRiseForBand(rampBand));
    expect(featureHeightAt(340, 400, ramp)).toBe(rampRiseForBand(rampBand));
  });

  it("stupňová rampa: gradient jen v pásmu sklonu", () => {
    const onSlope = floorHeightGradient(180, 225, [ramp]);
    expect(Math.abs(onSlope.dy)).toBeCloseTo(MAX_FLOOR_HEIGHT_GRAD, 3);
    const highPlateau = floorHeightGradient(180, 500, [ramp]);
    expect(Math.abs(highPlateau.dy)).toBeLessThan(1e-6);
    const lowPlateau = floorHeightGradient(180, 80, [ramp]);
    expect(Math.abs(lowPlateau.dy)).toBeLessThan(1e-6);
  });

  it("stupňová rampa: na vysoké nástupnici nulový tilt", () => {
    const t = floorHeightTilt(180, 520, [ramp]);
    expect(t.ax).toBe(0);
    expect(t.ay).toBe(0);
  });

  it("mesa: nížiny nahoře i dole, plochý střed", () => {
    const m = levelTerrainFeatures(LEVELS[14]).find((f) => f.shape === "mesa")!;
    expect(m.shape).toBe("mesa");
    expect(featureHeightAt(180, 50, m)).toBeLessThan(0.02);
    expect(featureHeightAt(180, 590, m)).toBeLessThan(0.02);
    const mid = featureHeightAt(180, 318, m);
    expect(mid).toBeGreaterThan(0.4);
    expect(floorHeightGradient(180, 318, [m]).dx).toBe(0);
    expect(Math.abs(floorHeightGradient(180, 318, [m]).dy)).toBeLessThan(1e-6);
  });

  it("úrovně 11–15: |∇h| nikde nepřekročí MAX_FLOOR_HEIGHT_GRAD", () => {
    const eps = 1.0005;
    for (const lvl of LEVELS.filter((l) => l.id >= 11)) {
      const maxG = maxFloorHeightGradientMagnitude(levelTerrainFeatures(lvl));
      expect(maxG, `úroveň ${lvl.id}`).toBeLessThanOrEqual(MAX_FLOOR_HEIGHT_GRAD * eps);
    }
  });

  it("composeBoardAndFloorTilts přičítá tilt z pole", () => {
    const c = composeBoardAndFloorTilts(0.2, 0, 228, 320, [basin]);
    const local = floorHeightTilt(228, 320, [basin]);
    expect(c.ax).toBeCloseTo(0.2 + local.ax, 4);
  });
});

describe("pit height field vs holeSlope", () => {
  const goal = { x: 100, y: 100, r: 20 };
  const hole = { cx: goal.x, cy: goal.y, r: goal.r };
  const pit: FloorPit[] = pitFeaturesFromHoles(goal, []);

  const inner = holeTriggerRadius(goal.r);
  const samples = [inner + 3, goal.r * 0.5, goal.r - 1, goal.r - 0.2];

  it.each(samples)("stejný tilt ve směru ke středu pro d≈%s", (d) => {
    const x = goal.x + d;
    const y = goal.y;
    const oldT = holeLocalTilt(x, y, hole);
    const newT = floorHeightTilt(x, y, pit);
    expect(newT.ax).toBeCloseTo(oldT.ax, 2);
    expect(newT.ay).toBeCloseTo(oldT.ay, 2);
  });

  it("trigger zóna: ploché dno ⇒ nulový tilt", () => {
    const x = goal.x + goal.r * HOLE_TRIGGER_FRAC * 0.5;
    expect(floorHeightTilt(x, goal.y, pit).ax).toBe(0);
  });
});
