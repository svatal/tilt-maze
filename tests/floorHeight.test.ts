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
  cx: 180,
  cy: 200,
  w: 120,
  h: 80,
  rise: 1,
  lowSide: "top",
  rampFrac: 0.4
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

  it("rampa: konstantní gradient podél sklonu", () => {
    const g = floorHeightGradient(180, 175, [ramp]);
    expect(g.dy).toBeGreaterThan(0);
    const t = floorHeightTilt(180, 175, [ramp]);
    expect(t.ay).toBeLessThan(0);
  });

  it("rampa: v centru nástupnice malý sklon", () => {
    const g = floorHeightGradient(180, 225, [ramp]);
    expect(Math.abs(g.dy)).toBeLessThan(0.12);
  });

  it("rampa: u boční hrany výška padá na nulu", () => {
    const edge = featureHeightAt(ramp.cx + ramp.w / 2 - 2, ramp.cy, ramp);
    expect(edge).toBeLessThan(0.08);
    const outer = featureHeightAt(ramp.cx + ramp.w / 2 + 4, ramp.cy, ramp);
    expect(outer).toBe(0);
  });

  it("composeBoardHoleAndFloorTilts přičítá tilt z pole", () => {
    const c = composeBoardHoleAndFloorTilts(0.2, 0, 228, 320, null, [], [basin]);
    const local = floorHeightTilt(228, 320, [basin]);
    expect(c.ax).toBeCloseTo(0.2 + local.ax, 4);
  });
});
