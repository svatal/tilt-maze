import { describe, expect, it } from "vitest";
import {
  composeBoardHoleAndFloorTilts,
  featureHeightAt,
  floorHeightAt,
  floorHeightGradient,
  floorHeightTilt,
  type FloorBowlCircle,
  type FloorRamp
} from "../src/floorHeight";

const basin: FloorBowlCircle = { shape: "bowl", cx: 180, cy: 320, r: 50, amplitude: -1 };
const hill: FloorBowlCircle = { shape: "bowl", cx: 180, cy: 320, r: 50, amplitude: 1 };

const ramp: FloorRamp = {
  shape: "ramp",
  axis: "horizontal",
  split: 220,
  band: 40,
  hLow: 0,
  hHigh: 1,
  lowSide: "top"
};

describe("floorHeight", () => {
  it("součet výšek z features", () => {
    expect(floorHeightAt(180, 320, [])).toBe(0);
    expect(featureHeightAt(180, 320, basin)).toBe(-1);
    expect(featureHeightAt(180, 320, hill)).toBe(1);
  });

  it("jamka: gradient směřuje ke středu (tilt dolů do jamky)", () => {
    const t = floorHeightTilt(228, 320, [basin]);
    expect(t.ax).toBeLessThan(0);
    expect(Math.hypot(t.ax, t.ay)).toBeGreaterThan(0.5);
  });

  it("kopec: opačný směr než jamka", () => {
    const b = floorHeightTilt(210, 330, [basin]);
    const h = floorHeightTilt(210, 330, [hill]);
    expect(Math.sign(b.ax)).toBe(-Math.sign(h.ax) || (b.ax === 0 && h.ax === 0));
  });

  it("stupňová rampa: dvě rovinné nástupnice přes celou šířku", () => {
    expect(featureHeightAt(20, 120, ramp)).toBe(0);
    expect(featureHeightAt(340, 120, ramp)).toBe(0);
    expect(featureHeightAt(20, 400, ramp)).toBe(1);
    expect(featureHeightAt(340, 400, ramp)).toBe(1);
  });

  it("stupňová rampa: gradient jen v pásmu sklonu", () => {
    const onSlope = floorHeightGradient(180, 225, [ramp]);
    expect(Math.abs(onSlope.dy)).toBeCloseTo(0.025, 3);
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

  it("composeBoardHoleAndFloorTilts přičítá tilt z pole", () => {
    const c = composeBoardHoleAndFloorTilts(0.2, 0, 228, 320, null, [], [basin]);
    const local = floorHeightTilt(228, 320, [basin]);
    expect(c.ax).toBeCloseTo(0.2 + local.ax, 4);
  });
});
