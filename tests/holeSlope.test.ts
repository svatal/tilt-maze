import { describe, expect, it } from "vitest";
import {
  ballCenterInDisk,
  composeBoardAndGoalTilt,
  goalLocalTilt,
  segmentCrossesDisk
} from "../src/holeSlope";

const goal = { cx: 100, cy: 100, r: 20 };

describe("goalLocalTilt", () => {
  it("mimo vliv → nula", () => {
    const v = goalLocalTilt(50, 50, goal);
    expect(v.ax).toBe(0);
    expect(v.ay).toBe(0);
  });

  it("u středu směřuje ke středu díry", () => {
    const v = goalLocalTilt(110, 100, goal);
    expect(v.ax).toBeLessThan(0);
    expect(Math.abs(v.ay)).toBeLessThan(0.05);
  });

  it("na hranici vlivu síla klesá", () => {
    const inner = goalLocalTilt(100, 112, goal);
    const outer = goalLocalTilt(100, 124, goal);
    expect(Math.hypot(inner.ax, inner.ay)).toBeGreaterThan(Math.hypot(outer.ax, outer.ay));
  });
});

describe("composeBoardAndGoalTilt", () => {
  it("přičítá lokální příspěvek bez ořezání board složek", () => {
    const c = composeBoardAndGoalTilt(2.5, -0.3, 98, 100, goal);
    const local = goalLocalTilt(98, 100, goal);
    expect(c.ax).toBeCloseTo(2.5 + local.ax, 5);
    expect(c.ay).toBeCloseTo(-0.3 + local.ay, 5);
  });
});

describe("ballCenterInDisk", () => {
  it("střed na hranici je uvnitř", () => {
    expect(ballCenterInDisk(120, 100, 100, 100, 20)).toBe(true);
  });

  it("mimo kotouč je false", () => {
    expect(ballCenterInDisk(130, 100, 100, 100, 20)).toBe(false);
  });
});

describe("segmentCrossesDisk", () => {
  it("rychlý průlet přes kotouč mezi snímky", () => {
    expect(segmentCrossesDisk(50, 100, 150, 100, 100, 100, 20)).toBe(true);
  });

  it("vedle kotouče bez vstupu", () => {
    expect(segmentCrossesDisk(50, 50, 150, 50, 100, 100, 20)).toBe(false);
  });

  it("těsný near-miss", () => {
    expect(segmentCrossesDisk(70, 70, 130, 70, 100, 100, 20)).toBe(false);
  });
});
