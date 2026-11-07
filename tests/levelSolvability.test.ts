import { describe, expect, it } from "vitest";
import {
  interiorWalls,
  isSpawnAndGoalClear,
  validateLevel1Shape,
  validateLevel10Slalom,
  validateLevelSet,
  validateWallsOnlyBand
} from "../src/levelGeometry";
import { isLevelSolvable } from "../src/levelSolvability";
import { LEVELS } from "../src/levels";
import { BALL_RADIUS } from "../src/constants";

describe("levelSolvability", () => {
  it("existuje přesně 10 úrovní", () => {
    expect(LEVELS).toHaveLength(10);
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("strukturální pravidla křivky obtížnosti", () => {
    expect(() => validateLevelSet(LEVELS)).not.toThrow();
    for (const lvl of LEVELS) {
      expect(validateLevel1Shape(lvl)).toBeNull();
      expect(validateWallsOnlyBand(lvl)).toBeNull();
      expect(validateLevel10Slalom(lvl)).toBeNull();
    }
  });

  it("úroveň 1: jen obvod, bez pastí", () => {
    const l = LEVELS[0];
    expect(l.traps).toHaveLength(0);
    expect(interiorWalls(l)).toHaveLength(0);
  });

  it("úrovně 2–5: bez pastí, s vnitřními zdmi", () => {
    for (const lvl of LEVELS.filter((x) => x.id >= 2 && x.id <= 5)) {
      expect(lvl.traps).toHaveLength(0);
      expect(interiorWalls(lvl).length).toBeGreaterThan(0);
    }
  });

  it("úroveň 10: slalom jen z pastí", () => {
    const l = LEVELS[9];
    expect(interiorWalls(l)).toHaveLength(0);
    expect(l.traps.length).toBeGreaterThanOrEqual(4);
  });

  it("start a cíl nekolidují se zdmi ani pastmi", () => {
    for (const lvl of LEVELS) {
      expect(isSpawnAndGoalClear(lvl, BALL_RADIUS), `úroveň ${lvl.id}`).toBe(true);
    }
  });

  it("každá úroveň má BFS cestu s poloměrem kuličky (ne náročnost hry)", () => {
    for (const lvl of LEVELS) {
      expect(isLevelSolvable(lvl), `úroveň ${lvl.id}`).toBe(true);
    }
  });
});
