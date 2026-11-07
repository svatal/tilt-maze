/** Rychlostní odraz kuličky od zdi – sdílené s GameScene a unit testy. */

/** Pod touto normální rychlostí odrazu není (kulička se přitiskne bez cukání). */
export const BOUNCE_IMPACT_SPEED_MIN = 0.45;
/** Od této rychlosti je použit plný koeficient odrazu. */
export const BOUNCE_IMPACT_SPEED_FULL = 4.2;
/** Horní mez koeficientu odrazu – žádné „pinball“ zesilování. */
export const BOUNCE_RESTITUTION_MAX = 0.34;

export type Vec2 = { x: number; y: number };

/** Plynulý náběh odrazu podle rychlosti nárazu (0…BOUNCE_RESTITUTION_MAX). */
export function restitutionForImpactSpeed(impactSpeed: number): number {
  if (impactSpeed < BOUNCE_IMPACT_SPEED_MIN) return 0;
  const span = BOUNCE_IMPACT_SPEED_FULL - BOUNCE_IMPACT_SPEED_MIN;
  const t = Math.min(1, (impactSpeed - BOUNCE_IMPACT_SPEED_MIN) / span);
  const eased = t * t * (3 - 2 * t);
  return BOUNCE_RESTITUTION_MAX * eased;
}

/**
 * Rychlost po odrazu: tangenciální složka zůstane, normální se odrazí s koeficientem e.
 * `normal` musí směřovat ze zdi směrem ke kuličce (ven z překážky).
 */
export function reflectVelocityAtWall(velocity: Vec2, normal: Vec2, impactSpeed: number): Vec2 {
  const e = restitutionForImpactSpeed(impactSpeed);
  if (e <= 0 || impactSpeed <= 0) {
    const vn = velocity.x * normal.x + velocity.y * normal.y;
    if (vn < 0) {
      return {
        x: velocity.x - vn * normal.x,
        y: velocity.y - vn * normal.y
      };
    }
    return { ...velocity };
  }
  const vn = velocity.x * normal.x + velocity.y * normal.y;
  const scale = vn - e * impactSpeed;
  return {
    x: velocity.x - scale * normal.x,
    y: velocity.y - scale * normal.y
  };
}

/** Normála kontaktu směřující ze statické překážky ke kuličce. */
export function wallNormalTowardBall(
  pair: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType; collision: { normal: { x: number; y: number } } },
  ballBody: MatterJS.BodyType
): Vec2 {
  const n = pair.collision.normal;
  const ballIsA = pair.bodyA === ballBody;
  let out = ballIsA ? { x: -n.x, y: -n.y } : { x: n.x, y: n.y };
  const len = Math.hypot(out.x, out.y);
  if (len >= 1e-4) {
    return { x: out.x / len, y: out.y / len };
  }
  const other = ballIsA ? pair.bodyB : pair.bodyA;
  const dx = ballBody.position.x - other.position.x;
  const dy = ballBody.position.y - other.position.y;
  const dlen = Math.hypot(dx, dy);
  if (dlen < 1e-4) {
    return { x: 0, y: -1 };
  }
  return { x: dx / dlen, y: dy / dlen };
}

export function approachSpeedTowardWall(velocity: Vec2, normalTowardBall: Vec2): number {
  const vn = velocity.x * normalTowardBall.x + velocity.y * normalTowardBall.y;
  return vn < 0 ? -vn : 0;
}

export type PendingWallBounce = {
  normal: Vec2;
  impactSpeed: number;
};

export function queueWallBounceFromPair(
  pair: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType; collision: { normal: { x: number; y: number } } },
  ballBody: MatterJS.BodyType,
  velocity: Vec2
): PendingWallBounce | null {
  let n = wallNormalTowardBall(pair, ballBody);
  let impactSpeed = approachSpeedTowardWall(velocity, n);
  const speed = Math.hypot(velocity.x, velocity.y);
  if (impactSpeed <= 0 && speed > 0.08) {
    const alt = { x: -n.x, y: -n.y };
    const altImpact = approachSpeedTowardWall(velocity, alt);
    if (altImpact > impactSpeed) {
      n = alt;
      impactSpeed = altImpact;
    }
  }
  if (impactSpeed <= 0) return null;
  return { normal: n, impactSpeed };
}

/** Použít po Matter solveru (restituce těles = 0), aby šlo přidat řízený odraz. */
export function velocityAfterWallBounce(velocity: Vec2, pending: PendingWallBounce): Vec2 {
  const { normal: n, impactSpeed } = pending;
  const e = restitutionForImpactSpeed(impactSpeed);
  const vn = velocity.x * n.x + velocity.y * n.y;
  let vx = velocity.x;
  let vy = velocity.y;
  if (vn < 0) {
    vx -= vn * n.x;
    vy -= vn * n.y;
  }
  if (e <= 0) {
    return { x: vx, y: vy };
  }
  const kick = e * impactSpeed;
  return { x: vx + kick * n.x, y: vy + kick * n.y };
}

export function isBounceObstacle(body: MatterJS.BodyType, ballBody: MatterJS.BodyType): boolean {
  if (body === ballBody || !body.isStatic || body.isSensor) return false;
  const label = String(body.label);
  return label !== "goal" && label !== "trap";
}
