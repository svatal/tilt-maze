/**
 * Čistá mapování naklonění → směrový vektor (před vyhlazením).
 * Osa Y: záporné rawY = síla nahoru na obrazovce (menší world y v Phaseru).
 */

import { hasRecentSensorData, shouldApplyMouseTilt } from "./mouseTiltMapping";

export type TiltSampleInput = {
  lastGamma: number | null;
  lastBeta: number | null;
  calGamma: number;
  calBeta: number;
  gravX: number;
  gravY: number;
  calGravX: number;
  calGravY: number;
  gsX: number;
  gsY: number;
  gsZ: number;
  calGsX: number;
  calGsY: number;
  calGsZ: number;
  keyX: number;
  keyY: number;
  mouseX: number;
  mouseY: number;
  mouseArmed: boolean;
  mousePointerInside: boolean;
  mouseWindowFocused: boolean;
  lastOrientTs: number;
  lastMotionTs: number;
  lastGravSensorTs: number;
  hasGravitySample: boolean;
  now: number;
};

/**
 * Vrací hrubé složky tiltu (před klipnutím a SMOOTH).
 */
export function computeRawTiltAxes(s: TiltSampleInput): { rawX: number; rawY: number } {
  const keyboard = s.keyX !== 0 || s.keyY !== 0;
  const sensorRecent = hasRecentSensorData(s);
  const mouseApply = shouldApplyMouseTilt({
    mouseArmed: s.mouseArmed,
    pointerInside: s.mousePointerInside,
    windowFocused: s.mouseWindowFocused,
    keyboardActive: keyboard,
    sensorRecent
  });

  if (mouseApply) {
    let rawX = s.mouseX;
    let rawY = s.mouseY;
    rawX = Math.max(-2.8, Math.min(2.8, rawX));
    rawY = Math.max(-2.8, Math.min(2.8, rawY));
    return { rawX, rawY };
  }

  let rawX = s.keyX;
  let rawY = s.keyY;

  const recentOrient = s.lastOrientTs > 0 && s.now - s.lastOrientTs < 550;
  const recentMotion = s.lastMotionTs > 0 && s.now - s.lastMotionTs < 550;
  const recentGs = s.hasGravitySample && s.now - s.lastGravSensorTs < 600;

  const haveOrientBoth =
    s.lastGamma !== null && s.lastBeta !== null && recentOrient;
  const haveOrientGamma = s.lastGamma !== null && recentOrient;

  const haveMotion =
    recentMotion &&
    (Math.abs(s.gravX - s.calGravX) > 0.08 || Math.abs(s.gravY - s.calGravY) > 0.08);

  if (haveOrientBoth) {
    const g = (s.lastGamma! - s.calGamma) * (Math.PI / 180);
    const b = (s.lastBeta! - s.calBeta) * (Math.PI / 180);
    rawX += Math.sin(g) * 2.2;
    // Top of phone away from user → ball rolls toward top of screen (−y): +sin(b)
    rawY += Math.sin(b) * 2.2;
  } else if (haveOrientGamma) {
    const g = (s.lastGamma! - s.calGamma) * (Math.PI / 180);
    rawX += Math.sin(g) * 2.2;
  } else if (haveMotion) {
    const dx = s.gravX - s.calGravX;
    const dy = s.gravY - s.calGravY;
    rawX += dx * 0.35;
    rawY += dy * 0.35;
  } else if (recentGs) {
    const dx = s.gsX - s.calGsX;
    const dy = s.gsY - s.calGsY;
    const dz = s.gsZ - s.calGsZ;
    const nx = dx / 9.81;
    const ny = dy / 9.81;
    const nz = dz / 9.81;
    rawX += nx * 2.4;
    rawY += ny * 2.4;
    if (Math.abs(nz) > 0.12) {
      rawY -= nz * 0.8;
    }
  }

  rawX = Math.max(-2.8, Math.min(2.8, rawX));
  rawY = Math.max(-2.8, Math.min(2.8, rawY));

  return { rawX, rawY };
}

/**
 * Konvence z testu: držíme γ=0, kalibrace 0. Když β > 0 (římský běžný režim — horní okraj k uživateli),
 * uživatel chce, aby „horní okraj od uživatele“ (opak) znamenal pohyb nahoru — testujeme znaménko
 * pro kladné β−cal: očekáváme rawY < 0 (síla nahoru).
 */
export function rawTiltFromBetaOnly(betaDeg: number, calBetaDeg = 0): number {
  const s: TiltSampleInput = {
    lastGamma: 0,
    lastBeta: betaDeg,
    calGamma: 0,
    calBeta: calBetaDeg,
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
    keyX: 0,
    keyY: 0,
    mouseX: 0,
    mouseY: 0,
    mouseArmed: false,
    mousePointerInside: false,
    mouseWindowFocused: true,
    lastOrientTs: 1,
    lastMotionTs: 0,
    lastGravSensorTs: 0,
    hasGravitySample: false,
    now: 100
  };
  return computeRawTiltAxes(s).rawY;
}
