import { describe, expect, it } from "vitest";
import {
  HOLE_TRIGGER_FRAC,
  ballCenterTriggersHoleSink,
  holeTriggerRadius,
  type HoleDef
} from "../src/holeSlope";

const goal: HoleDef = { cx: 100, cy: 100, r: 20 };

describe("trigger zóna 0.25·r", () => {
  it("poloměr trigger = čtvrtina průměru", () => {
    expect(holeTriggerRadius(20)).toBe(5);
    expect(HOLE_TRIGGER_FRAC).toBe(0.25);
  });

  it("na polovině poloměru (0.5r) trigger ne", () => {
    expect(ballCenterTriggersHoleSink(110, 100, goal)).toBe(false);
  });

  it("vnitřní trigger ano", () => {
    expect(ballCenterTriggersHoleSink(104, 100, goal)).toBe(true);
  });

  it("okraj viditelné díry neaktivuje trigger", () => {
    expect(ballCenterTriggersHoleSink(120, 100, goal)).toBe(false);
  });
});