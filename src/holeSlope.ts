/**
 * Lokální sklon v mělké misce (2D aproximace). Viditelný poloměr r = level + vykreslení.
 * Trigger animace: jen střed kuličky uvnitř poloviny poloměru (0.5·r).
 * Mezikruh 0.5r < dist ≤ r: lokální tah do středu, bez animace.
 */

export type HoleDef = { cx: number; cy: number; r: number };

/** Poloměr vnitřní zóny pro spuštění sink/settle tween (polovina průměru díry). */
export const HOLE_TRIGGER_FRAC = 0.5;

const HOLE_PEAK_TILT = 1.38;

export function holeTriggerRadius(visibleR: number): number {
  return visibleR * HOLE_TRIGGER_FRAC;
}

export function ballCenterDistance(ballX: number, ballY: number, hole: HoleDef): number {
  return Math.hypot(ballX - hole.cx, ballY - hole.cy);
}

/** Střed uvnitř viditelné díry (dist ≤ r). */
export function ballCenterInVisibleHole(ballX: number, ballY: number, hole: HoleDef): boolean {
  return ballCenterDistance(ballX, ballY, hole) <= hole.r;
}

/**
 * Mezikruh pro lokální sklon — ne ve vnitřní trigger zóně, ne mimo díru.
 */
export function ballInHoleSlopeAnnulus(ballX: number, ballY: number, hole: HoleDef): boolean {
  const d = ballCenterDistance(ballX, ballY, hole);
  const inner = holeTriggerRadius(hole.r);
  return d <= hole.r && d > inner;
}

/** Terminální animace: výhradně střed uvnitř inner disku (žádný segment / předchozí snímek). */
export function ballCenterTriggersHoleSink(ballX: number, ballY: number, hole: HoleDef): boolean {
  return ballCenterDistance(ballX, ballY, hole) <= holeTriggerRadius(hole.r);
}

export function holeLocalTilt(ballX: number, ballY: number, hole: HoleDef): { ax: number; ay: number } {
  const d = ballCenterDistance(ballX, ballY, hole);
  const inner = holeTriggerRadius(hole.r);
  if (d > hole.r || d <= inner) return { ax: 0, ay: 0 };

  const dx = hole.cx - ballX;
  const dy = hole.cy - ballY;
  const towardX = d > 1e-6 ? dx / d : 0;
  const towardY = d > 1e-6 ? dy / d : 0;
  const span = hole.r - inner;
  const t = span > 0 ? (hole.r - d) / span : 0;
  const mag = HOLE_PEAK_TILT * t * t;
  return { ax: towardX * mag, ay: towardY * mag };
}

export function composeBoardAndHoleTilts(
  boardAx: number,
  boardAy: number,
  ballX: number,
  ballY: number,
  goal: HoleDef | null,
  trapHoles: HoleDef[]
): { ax: number; ay: number } {
  let ax = boardAx;
  let ay = boardAy;
  if (goal && ballInHoleSlopeAnnulus(ballX, ballY, goal)) {
    const l = holeLocalTilt(ballX, ballY, goal);
    ax += l.ax;
    ay += l.ay;
  }
  for (const h of trapHoles) {
    if (ballInHoleSlopeAnnulus(ballX, ballY, h)) {
      const l = holeLocalTilt(ballX, ballY, h);
      ax += l.ax;
      ay += l.ay;
    }
  }
  return { ax, ay };
}
