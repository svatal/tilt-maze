import { describe, expect, it } from "vitest";
import {
  ballCenterInDisk,
  ballInHoleInfluence,
  composeBoardAndHoleTilts,
  entersVisibleBowl,
  holeCoreRadius,
  holeLocalTilt,
  reachesHoleCore,
  segmentCrossesDisk,
  type HoleDef
} from "../src/holeSlope";

const goal: HoleDef = { cx: 100, cy: 100, r: 20 };
const FORCE_MULT = 0.00085;

describe("holeLocalTilt", () => {
  it("mimo vliv → nula", () => {
    const v = holeLocalTilt(50, 50, goal);
    expect(v.ax).toBe(0);
    expect(v.ay).toBe(0);
  });

  it("na kraji misky směřuje ke středu s nenulovou silou", () => {
    const v = holeLocalTilt(118, 100, goal);
    expect(v.ax).toBeLessThan(0);
    expect(Math.hypot(v.ax, v.ay)).toBeGreaterThan(0.04);
  });

  it("blíž ke středu síla roste", () => {
    const inner = holeLocalTilt(105, 100, goal);
    const rim = holeLocalTilt(118, 100, goal);
    expect(Math.hypot(inner.ax, inner.ay)).toBeGreaterThan(Math.hypot(rim.ax, rim.ay));
  });
});

describe("terminální jádro vs okraj", () => {
  it("okraj viditelné díry není jádro", () => {
    const coreTrap = holeCoreRadius(goal.r, "trap");
    const coreGoal = holeCoreRadius(goal.r, "goal");
    expect(ballCenterInDisk(118, 100, goal.cx, goal.cy, coreTrap)).toBe(false);
    expect(ballCenterInDisk(104, 100, goal.cx, goal.cy, coreGoal)).toBe(true);
  });

  it("reachesHoleCore na okraji misky (bez průletu jádrem) → false", () => {
    expect(reachesHoleCore(118, 100, 117, 100, goal)).toBe(false);
  });

  it("průlet jádrem mezi snímky → true", () => {
    expect(reachesHoleCore(50, 100, 150, 100, goal)).toBe(true);
  });
});

describe("composeBoardAndHoleTilts", () => {
  it("přičítá lokální misku uvnitř vlivu", () => {
    const hole = goal;
    const c = composeBoardAndHoleTilts(0.5, 0, 105, 100, null, [hole]);
    const local = holeLocalTilt(105, 100, hole);
    expect(c.ax).toBeCloseTo(0.5 + local.ax, 5);
  });
});

describe("síla misky roste směrem ke středu", () => {
  it("blíž středu → silnější lokální tah", () => {
    const mid = holeLocalTilt(108, 100, goal);
    const deep = holeLocalTilt(103, 100, goal);
    expect(Math.hypot(deep.ax, deep.ay)).toBeGreaterThan(Math.hypot(mid.ax, mid.ay));
    expect(deep.ax).toBeLessThan(0);
  });
});

describe("past — zarážka", () => {
  const trap: HoleDef = { cx: 180, cy: 320, r: 22 };

  it("vstup do viditelné misky", () => {
    expect(entersVisibleBowl(150, 320, 198, 320, trap)).toBe(true);
    expect(ballInHoleInfluence(198, 320, trap)).toBe(true);
  });

  it("near-miss mimo", () => {
    expect(entersVisibleBowl(150, 280, 210, 280, trap)).toBe(false);
  });
});

describe("segmentCrossesDisk", () => {
  it("rychlý průlet přes kotouč mezi snímky", () => {
    expect(segmentCrossesDisk(50, 100, 150, 100, 100, 100, 20)).toBe(true);
  });
});
