/**
 * Lokální sklon v mělké misce (2D aproximace). Viditelný poloměr r = level + vykreslení.
 * Trigger animace: jen střed kuličky uvnitř 0.25·r (čtvrtina průměru, aktuální snímek).
 * Mezikruh 0.25r < dist ≤ r: lokální tilt; uvnitř trigger zóny jen animace (žádný lokální sklon).
 *
 * Profil úhlu (nominalní ° ekvivalent u hrany, ne doslovný 3D úhel):
 *   mimo (d > r) → 0; při překročení okraje náhlý skok na max;
 *   uvnitř mezikruhu úhel lineárně klesá k 0 při d → 0.25r (slabší směrem ke středu).
 *   θ(d) = θ_rim · (d/r) pro 0.25r < d ≤ r.
 * Mapování na jednotky board tiltu: |a| = TILT_SIN_SCALE · sin(θ), stejně jako tiltMapping u orientace.
 */

export type HoleDef = { cx: number; cy: number; r: number };

export const HOLE_TRIGGER_FRAC = 0.25;

/** Úhel na viditelném okraji díry (d = r). */
export const HOLE_RIM_ANGLE_DEG = 45;

/** Odpovídá sin-faktoru v computeRawTiltAxes (γ/β → raw). */
export const TILT_SIN_SCALE = 2.2;

export function holeTriggerRadius(visibleR: number): number {
  return visibleR * HOLE_TRIGGER_FRAC;
}

export function ballCenterDistance(ballX: number, ballY: number, hole: HoleDef): number {
  return Math.hypot(ballX - hole.cx, ballY - hole.cy);
}

export function ballCenterInVisibleHole(ballX: number, ballY: number, hole: HoleDef): boolean {
  return ballCenterDistance(ballX, ballY, hole) <= hole.r;
}

export function ballInHoleSlopeAnnulus(ballX: number, ballY: number, hole: HoleDef): boolean {
  const d = ballCenterDistance(ballX, ballY, hole);
  return d <= hole.r && d > holeTriggerRadius(hole.r);
}

export function ballCenterTriggersHoleSink(ballX: number, ballY: number, hole: HoleDef): boolean {
  return ballCenterDistance(ballX, ballY, hole) <= holeTriggerRadius(hole.r);
}

/** Nominalní úhel misky [°] pro vzdálenost d od středu; 0 mimo mezikruh. */
export function holeLocalTiltAngleDeg(d: number, visibleR: number): number {
  if (d > visibleR || d <= holeTriggerRadius(visibleR)) return 0;
  return HOLE_RIM_ANGLE_DEG * (d / visibleR);
}

/** Velikost lokální složky ax/ay (před FORCE_MULT) z úhlu. */
export function holeLocalTiltMagnitude(d: number, visibleR: number): number {
  const deg = holeLocalTiltAngleDeg(d, visibleR);
  if (deg <= 0) return 0;
  return TILT_SIN_SCALE * Math.sin((deg * Math.PI) / 180);
}

export function holeLocalTilt(ballX: number, ballY: number, hole: HoleDef): { ax: number; ay: number } {
  const d = ballCenterDistance(ballX, ballY, hole);
  const inner = holeTriggerRadius(hole.r);
  if (d > hole.r || d <= inner) return { ax: 0, ay: 0 };

  const dx = hole.cx - ballX;
  const dy = hole.cy - ballY;
  const towardX = d > 1e-6 ? dx / d : 0;
  const towardY = d > 1e-6 ? dy / d : 0;
  const mag = holeLocalTiltMagnitude(d, hole.r);
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
