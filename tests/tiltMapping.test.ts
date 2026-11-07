import { describe, expect, it } from "vitest";
import { computeRawTiltAxes, rawTiltFromBetaOnly } from "../src/tiltMapping";

describe("tiltMapping", () => {
  it("záporný β oproti kalibraci → rawY < 0 (kulička nahoru na obrazovce; horní okraj od uživatele / „top away‘ ve W3C)", () => {
    expect(rawTiltFromBetaOnly(-20, 0)).toBeLessThan(0);
  });

  it("kladný β oproti kalibraci → rawY > 0", () => {
    expect(rawTiltFromBetaOnly(20, 0)).toBeGreaterThan(0);
  });

  it("devicemotion: kladný delta gravY → rawY > 0 (odpovídá fyzickému kutálení dolů)", () => {
    const s = computeRawTiltAxes({
      lastGamma: null,
      lastBeta: null,
      calGamma: 0,
      calBeta: 0,
      gravX: 0,
      gravY: 0.5,
      calGravX: 0,
      calGravY: 0,
      gsX: 0,
      gsY: 0,
      gsZ: 0,
      calGsX: 0,
      calGsY: 0,
      calGsZ: 0,
      keyX: 0,
      keyY: 0,
      mouseX: 0,
      mouseY: 0,
      mouseArmed: false,
      mousePointerInside: false,
      mouseWindowFocused: true,
      lastOrientTs: 0,
      lastMotionTs: 100,
      lastGravSensorTs: 0,
      hasGravitySample: false,
      now: 200
    });
    expect(s.rawY).toBeGreaterThan(0);
  });

  it("GravitySensor: kladný delta Y → rawY > 0", () => {
    const s = computeRawTiltAxes({
      lastGamma: null,
      lastBeta: null,
      calGamma: 0,
      calBeta: 0,
      gravX: 0,
      gravY: 0,
      calGravX: 0,
      calGravY: 0,
      gsX: 0,
      gsY: 0.5,
      gsZ: 9.81,
      calGsX: 0,
      calGsY: 0,
      calGsZ: 9.81,
      keyX: 0,
      keyY: 0,
      mouseX: 0,
      mouseY: 0,
      mouseArmed: false,
      mousePointerInside: false,
      mouseWindowFocused: true,
      lastOrientTs: 0,
      lastMotionTs: 0,
      lastGravSensorTs: 100,
      hasGravitySample: true,
      now: 200
    });
    expect(s.rawY).toBeGreaterThan(0);
  });
});
