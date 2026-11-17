/**
 * Geometrie cíle a pastí: trigger zóna propadu (logika animace, ne výškové pole).
 */

export type HoleDef = { cx: number; cy: number; r: number };

export const HOLE_TRIGGER_FRAC = 0.25;

export function holeTriggerRadius(visibleR: number): number {
  return visibleR * HOLE_TRIGGER_FRAC;
}

export function ballCenterDistance(ballX: number, ballY: number, hole: HoleDef): number {
  return Math.hypot(ballX - hole.cx, ballY - hole.cy);
}

export function ballCenterTriggersHoleSink(ballX: number, ballY: number, hole: HoleDef): boolean {
  return ballCenterDistance(ballX, ballY, hole) <= holeTriggerRadius(hole.r);
}