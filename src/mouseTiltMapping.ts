/** Analogové naklonění z pozice kurzoru vůči středu herní plochy (před vyhlazením). */

import type { TiltSampleInput } from "./tiltMapping";

export const MOUSE_MAX_FORCE = 1.2;
export const MOUSE_DEAD_ZONE = 0.07;

export type PlayAreaRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type NormalizedPointer = {
  /** −1…1 vůči poloviční šířce plochy */
  nx: number;
  /** −1…1 vůči poloviční výšce plochy */
  ny: number;
  /** Kurzor uvnitř vykreslené herní plochy (canvas FIT) */
  inside: boolean;
};

/**
 * Převod client souřadnic na normalizovaný offset od středu; mimo plochu = neutrál.
 */
export function clientToNormalizedPointer(
  clientX: number,
  clientY: number,
  area: PlayAreaRect
): NormalizedPointer {
  if (area.width <= 0 || area.height <= 0) {
    return { nx: 0, ny: 0, inside: false };
  }
  const cx = area.left + area.width / 2;
  const cy = area.top + area.height / 2;
  const inside =
    clientX >= area.left &&
    clientX <= area.left + area.width &&
    clientY >= area.top &&
    clientY <= area.top + area.height;
  if (!inside) {
    return { nx: 0, ny: 0, inside: false };
  }
  const nx = (clientX - cx) / (area.width / 2);
  const ny = (clientY - cy) / (area.height / 2);
  return { nx, ny, inside: true };
}

/** Plynulá síla 0…1 od okraje mrtvé zóny po okraj elipsy. */
export function magnitudeFromNormDistance(nx: number, ny: number, deadZone = MOUSE_DEAD_ZONE): number {
  const mag = Math.hypot(nx, ny);
  if (mag <= deadZone) return 0;
  const capped = Math.min(mag, 1);
  const t = (capped - deadZone) / (1 - deadZone);
  return t * t;
}

/**
 * Směr = od středu ke kurzoru; síla roste s vzdáleností (omezená na 1 v norm. elipse).
 * rawY < 0 = kulička nahoru na obrazovce (jako šipka nahoru / záporný β efekt).
 */
export function mapNormalizedPointerToTilt(
  nx: number,
  ny: number,
  maxForce = MOUSE_MAX_FORCE,
  deadZone = MOUSE_DEAD_ZONE
): { x: number; y: number } {
  const mag = Math.hypot(nx, ny);
  if (mag <= deadZone) return { x: 0, y: 0 };
  const strength = magnitudeFromNormDistance(nx, ny, deadZone);
  const ux = nx / mag;
  const uy = ny / mag;
  return {
    x: ux * strength * maxForce,
    y: uy * strength * maxForce
  };
}

export function playAreaFromCanvasBounds(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): PlayAreaRect {
  return {
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height
  };
}

export function hasRecentSensorData(s: Pick<TiltSampleInput, "lastOrientTs" | "lastMotionTs" | "lastGravSensorTs" | "hasGravitySample" | "lastGamma" | "lastBeta" | "now" | "gravX" | "gravY" | "calGravX" | "calGravY">): boolean {
  const recentOrient = s.lastOrientTs > 0 && s.now - s.lastOrientTs < 550;
  const recentMotion = s.lastMotionTs > 0 && s.now - s.lastMotionTs < 550;
  const recentGs = s.hasGravitySample && s.now - s.lastGravSensorTs < 600;
  const haveOrientBoth = s.lastGamma !== null && s.lastBeta !== null && recentOrient;
  const haveOrientGamma = s.lastGamma !== null && recentOrient;
  const haveMotion =
    recentMotion &&
    (Math.abs(s.gravX - s.calGravX) > 0.08 || Math.abs(s.gravY - s.calGravY) > 0.08);
  return haveOrientBoth || haveOrientGamma || haveMotion || recentGs;
}

export type MouseArbitrationInput = {
  mouseArmed: boolean;
  pointerInside: boolean;
  windowFocused: boolean;
};

/** Zapnutá myš v běžícím okně = režim bez senzoru (vzájemně výlučné). */
export function mouseModeSuppressesSensor(mouseArmed: boolean, windowFocused: boolean): boolean {
  return mouseArmed && windowFocused;
}

/** Myš jen při aktivaci, fokusu a kurzoru v ploše. */
export function shouldApplyMouseTilt(a: MouseArbitrationInput): boolean {
  if (!mouseModeSuppressesSensor(a.mouseArmed, a.windowFocused)) return false;
  if (!a.pointerInside) return false;
  return true;
}
