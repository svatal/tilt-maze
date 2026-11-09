import { describe, expect, it } from "vitest";
import { computeRawTiltAxes } from "../src/tiltMapping";
import {
  clientToNormalizedPointer,
  magnitudeFromNormDistance,
  mapNormalizedPointerToTilt,
  shouldApplyMouseTilt,
  type PlayAreaRect
} from "../src/mouseTiltMapping";

const AREA: PlayAreaRect = { left: 100, top: 50, width: 200, height: 400 };

const baseTiltSample = {
  lastGamma: null as number | null,
  lastBeta: null as number | null,
  calGamma: 0,
  calBeta: 0,
  gravX: 0,
  gravY: 0,
  calGravX: 0,
  calGravY: 0,
  gsX: 0,
  gsY: 0,
  gsZ: 0,
  calGsX: 0,
  calGsY: 0,
  calGsZ: 0,
  mouseX: 0,
  mouseY: 0,
  mouseArmed: false,
  mousePointerInside: false,
  mouseWindowFocused: true,
  lastOrientTs: 0,
  lastMotionTs: 0,
  lastGravSensorTs: 0,
  hasGravitySample: false,
  now: 500
};

describe("mouseTiltMapping", () => {
  it("střed plochy → neutrální tilt", () => {
    const p = clientToNormalizedPointer(200, 250, AREA);
    expect(p.inside).toBe(true);
    expect(p.nx).toBeCloseTo(0, 5);
    expect(p.ny).toBeCloseTo(0, 5);
    const t = mapNormalizedPointerToTilt(p.nx, p.ny);
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
  });

  it("vzdálenost od středu postupně zvyšuje sílu", () => {
    const m1 = magnitudeFromNormDistance(0.2, 0);
    const m2 = magnitudeFromNormDistance(0.6, 0);
    const m3 = magnitudeFromNormDistance(1, 0);
    expect(m1).toBeGreaterThan(0);
    expect(m2).toBeGreaterThan(m1);
    expect(m3).toBeGreaterThan(m2);
    expect(m3).toBeLessThanOrEqual(1);
  });

  it("směr: kurzor vpravo → kladné rawX", () => {
    const p = clientToNormalizedPointer(280, 250, AREA);
    const t = mapNormalizedPointerToTilt(p.nx, p.ny);
    expect(t.x).toBeGreaterThan(0);
    expect(Math.abs(t.y)).toBeLessThan(0.15);
  });

  it("směr: kurzor nahoru → záporné rawY (kulička nahoru)", () => {
    const p = clientToNormalizedPointer(200, 80, AREA);
    const t = mapNormalizedPointerToTilt(p.nx, p.ny);
    expect(t.y).toBeLessThan(0);
  });

  it("mimo plochu → uvnitř false a nulový vektor", () => {
    const p = clientToNormalizedPointer(50, 250, AREA);
    expect(p.inside).toBe(false);
    const t = mapNormalizedPointerToTilt(p.nx, p.ny);
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
  });

  it("clamp na max sílu", () => {
    const t = mapNormalizedPointerToTilt(3, 0);
    expect(t.x).toBeLessThanOrEqual(1.2);
  });

  it("různý poměr stran: normalizace po ose", () => {
    const wide: PlayAreaRect = { left: 0, top: 0, width: 400, height: 200 };
    const p = clientToNormalizedPointer(400, 100, wide);
    expect(p.nx).toBeCloseTo(1, 5);
    expect(p.ny).toBeCloseTo(0, 5);
  });

  it("arbitráž: bez fokusu myš neaktivní", () => {
    expect(
      shouldApplyMouseTilt({
        mouseArmed: true,
        pointerInside: true,
        windowFocused: false
      })
    ).toBe(false);
  });

  it("integrace: myš při aktivaci bez senzoru", () => {
    const out = computeRawTiltAxes({
      ...baseTiltSample,
      mouseArmed: true,
      mousePointerInside: true,
      mouseX: 0.8,
      mouseY: -0.5
    });
    expect(out.rawX).toBeCloseTo(0.8, 2);
    expect(out.rawY).toBeCloseTo(-0.5, 2);
  });

  it("integrace: zapnutá myš ignoruje čerstvý senzor", () => {
    const out = computeRawTiltAxes({
      ...baseTiltSample,
      lastGamma: 0,
      lastBeta: 25,
      lastOrientTs: 400,
      mouseArmed: true,
      mousePointerInside: true,
      mouseX: 1.1,
      mouseY: -0.4,
      now: 500
    });
    expect(out.rawX).toBeCloseTo(1.1, 2);
    expect(out.rawY).toBeCloseTo(-0.4, 2);
  });

  it("integrace: po vypnutí myši senzor znovu platí", () => {
    const out = computeRawTiltAxes({
      ...baseTiltSample,
      lastGamma: 0,
      lastBeta: 25,
      lastOrientTs: 400,
      mouseArmed: false,
      mousePointerInside: false,
      mouseX: 1.1,
      mouseY: 1.1,
      now: 500
    });
    expect(out.rawY).toBeGreaterThan(0);
  });

  it("integrace: myš zapnutá, kurzor mimo plochu — bez senzoru", () => {
    const out = computeRawTiltAxes({
      ...baseTiltSample,
      lastGamma: 0,
      lastBeta: 25,
      lastOrientTs: 400,
      mouseArmed: true,
      mousePointerInside: false,
      mouseX: 0,
      mouseY: 0,
      now: 500
    });
    expect(out.rawX).toBe(0);
    expect(out.rawY).toBe(0);
  });
});
