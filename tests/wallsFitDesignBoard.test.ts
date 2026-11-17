import { describe, expect, it } from "vitest";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../src/constants";
import { LEVELS } from "../src/levels";
import type { LevelDef } from "../src/levels";

function wallsInsideDesignBoard(lvl: LevelDef): boolean {
  for (const w of lvl.walls) {
    const left = w.cx - w.w / 2;
    const right = w.cx + w.w / 2;
    const top = w.cy - w.h / 2;
    const bottom = w.cy + w.h / 2;
    if (left < 0 || right > DESIGN_WIDTH || top < 0 || bottom > DESIGN_HEIGHT) {
      return false;
    }
  }
  return true;
}

describe("wallsFitDesignBoard", () => {
  it("všechny zdi každé úrovně jsou uvnitř design boardu", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const lvl = LEVELS[i];
      expect(wallsInsideDesignBoard(lvl), `úroveň ${i + 1} (${lvl.id})`).toBe(true);
    }
  });
});