import { describe, expect, it } from "vitest";
import {
  FLOOR_BASIN_PROFILE,
  FLOOR_HILL_PROFILE,
  ballInFloorSlope,
  composeBoardHoleAndFloorTilts,
  floorSlopeLocalTilt,
  type FloorSlopeCircle,
  type FloorSlopeRect
} from "../src/floorSlope";
import { bowlLocalTiltMagnitude, bowlTriggerRadius } from "../src/holeSlope";

const basin: FloorSlopeCircle = { shape: "circle", cx: 180, cy: 320, r: 50, kind: "basin" };
const hill: FloorSlopeCircle = { shape: "circle", cx: 180, cy: 320, r: 50, kind: "hill" };
const ramp: FloorSlopeRect = { shape: "rect", cx: 160, cy: 300, w: 120, h: 44, kind: "basin" };

describe("floorSlope", () => {
  it("mimo region → nulová síla", () => {
    expect(ballInFloorSlope(50, 50, basin)).toBe(false);
    expect(floorSlopeLocalTilt(50, 50, basin)).toEqual({ ax: 0, ay: 0 });
  });

  it("jamka: na okraji tah ke středu", () => {
    const t = floorSlopeLocalTilt(228, 320, basin);
    expect(t.ax).toBeLessThan(0);
    expect(Math.abs(t.ay)).toBeLessThan(0.1);
    expect(Math.hypot(t.ax, t.ay)).toBeGreaterThan(0.9);
  });

  it("kopec: na okraji tah od středu", () => {
    const t = floorSlopeLocalTilt(228, 320, hill);
    expect(t.ax).toBeGreaterThan(0);
    expect(Math.hypot(t.ax, t.ay)).toBeGreaterThan(0.75);
  });

  it("hill a basin mají opačný směr ve stejném bodě", () => {
    const b = floorSlopeLocalTilt(210, 330, basin);
    const h = floorSlopeLocalTilt(210, 330, hill);
    expect(Math.sign(b.ax)).toBe(-Math.sign(h.ax) || (b.ax === 0 && h.ax === 0));
  });

  it("obdélníková jamka: uvnitř nenulová síla", () => {
    expect(ballInFloorSlope(160, 305, ramp)).toBe(true);
    const t = floorSlopeLocalTilt(175, 310, ramp);
    expect(Math.hypot(t.ax, t.ay)).toBeGreaterThan(0.4);
  });

  it("slabší než díra při stejném r (nižší θ_rim)", () => {
    const d = 48;
    const holeMag = bowlLocalTiltMagnitude(d, 50, { rimAngleDeg: 45, triggerFrac: 0.25 });
    const floorMag = bowlLocalTiltMagnitude(d, 50, FLOOR_BASIN_PROFILE);
    expect(floorMag).toBeLessThan(holeMag);
    expect(bowlTriggerRadius(50, FLOOR_BASIN_PROFILE.triggerFrac)).toBe(0);
    expect(bowlTriggerRadius(50, FLOOR_HILL_PROFILE.triggerFrac)).toBe(0);
  });

  it("composeBoardHoleAndFloorTilts sčítá podlahový příspěvek", () => {
    const c = composeBoardHoleAndFloorTilts(0.2, 0, 228, 320, null, [], [basin]);
    const local = floorSlopeLocalTilt(228, 320, basin);
    expect(c.ax).toBeCloseTo(0.2 + local.ax, 5);
    expect(c.ay).toBeCloseTo(local.ay, 5);
  });
});
