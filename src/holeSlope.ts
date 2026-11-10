/**
 * Lokální sklon v mělké misce (2D aproximace). Viditelný poloměr r = level + vykreslení.
 * Trigger animace: jen střed kuličky uvnitř 0.25·r (čtvrtina průměru, aktuální snímek).
 * Mezikruh 0.25r < dist ≤ r: lokální tilt; uvnitř trigger zóny jen animace (žádný lokální sklon).
 *
 * Profil úhlu (nominalní ° ekvivalent u hrany, ne doslovný 3D úhel):
 *   mimo (d > r) → 0; při překročení okraje náhlý skok na max;
 *   uvnitř mezikruhu úhel lineárně klesá k 0 při d → trigger poloměr (slabší směrem ke středu).
 *   θ(d) = θ_rim · (d/r) pro trigger < d ≤ r.
 * Mapování na jednotky board tiltu: |a| = TILT_SIN_SCALE · sin(θ), stejně jako tiltMapping u orientace.
 */

export type HoleDef = { cx: number; cy: number; r: number };

export type BowlTiltProfile = {
  rimAngleDeg: number;
  triggerFrac: number;
};

export const HOLE_TRIGGER_FRAC = 0.25;

/** Úhel na viditelném okraji díry (d = r). */
export const HOLE_RIM_ANGLE_DEG = 45;

export const HOLE_BOWL_PROFILE: BowlTiltProfile = {
  rimAngleDeg: HOLE_RIM_ANGLE_DEG,
  triggerFrac: HOLE_TRIGGER_FRAC
};

/** Odpovídá sin-faktoru v computeRawTiltAxes (γ/β → raw). */
export const TILT_SIN_SCALE = 2.2;

export function bowlTriggerRadius(visibleR: number, triggerFrac: number): number {
  return visibleR * triggerFrac;
}

export function holeTriggerRadius(visibleR: number): number {
  return bowlTriggerRadius(visibleR, HOLE_TRIGGER_FRAC);
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
export function bowlLocalTiltAngleDeg(d: number, visibleR: number, profile: BowlTiltProfile): number {
  const inner = bowlTriggerRadius(visibleR, profile.triggerFrac);
  if (d > visibleR || d <= inner) return 0;
  return profile.rimAngleDeg * (d / visibleR);
}

export function holeLocalTiltAngleDeg(d: number, visibleR: number): number {
  return bowlLocalTiltAngleDeg(d, visibleR, HOLE_BOWL_PROFILE);
}

/** Velikost lokální složky ax/ay (před FORCE_MULT) z úhlu. */
export function bowlLocalTiltMagnitude(d: number, visibleR: number, profile: BowlTiltProfile): number {
  const deg = bowlLocalTiltAngleDeg(d, visibleR, profile);
  if (deg <= 0) return 0;
  return TILT_SIN_SCALE * Math.sin((deg * Math.PI) / 180);
}

export function holeLocalTiltMagnitude(d: number, visibleR: number): number {
  return bowlLocalTiltMagnitude(d, visibleR, HOLE_BOWL_PROFILE);
}

/**
 * Lokální tilt miso do středu (downhill = směr ke středu kruhu).
 * `towardCenter: false` invertuje sílu (kopec).
 */
export function bowlLocalTiltToward(
  ballX: number,
  ballY: number,
  bowl: HoleDef,
  profile: BowlTiltProfile,
  towardCenter: boolean
): { ax: number; ay: number } {
  const d = ballCenterDistance(ballX, ballY, bowl);
  const inner = bowlTriggerRadius(bowl.r, profile.triggerFrac);
  if (d > bowl.r || d <= inner) return { ax: 0, ay: 0 };

  const dx = bowl.cx - ballX;
  const dy = bowl.cy - ballY;
  const towardX = d > 1e-6 ? dx / d : 0;
  const towardY = d > 1e-6 ? dy / d : 0;
  const mag = bowlLocalTiltMagnitude(d, bowl.r, profile);
  const sign = towardCenter ? 1 : -1;
  return { ax: towardX * mag * sign, ay: towardY * mag * sign };
}

export function holeLocalTilt(ballX: number, ballY: number, hole: HoleDef): { ax: number; ay: number } {
  return bowlLocalTiltToward(ballX, ballY, hole, HOLE_BOWL_PROFILE, true);
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
