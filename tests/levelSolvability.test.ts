import { describe, expect, it } from "vitest";
import { isLevelSolvable } from "../src/levelSolvability";
import { LEVELS } from "../src/levels";

describe("levelSolvability", () => {
  it("každá úroveň má BFS cestu od startu k cíli", () => {
    for (const lvl of LEVELS) {
      expect(isLevelSolvable(lvl), `úroveň ${lvl.id}`).toBe(true);
    }
  });
});
