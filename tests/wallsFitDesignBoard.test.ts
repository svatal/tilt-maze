import { describe, expect, it } from "vitest";
import { wallsFitDesignBoard } from "../src/levelGeometry";
import { LEVELS } from "../src/levels";

describe("wallsFitDesignBoard", () => {
  it("všechny zdi každé úrovně jsou uvnitř design boardu", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const lvl = LEVELS[i];
      expect(wallsFitDesignBoard(lvl), `úroveň ${i + 1} (${lvl.id})`).toBe(true);
    }
  });
});