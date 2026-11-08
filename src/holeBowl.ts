/** Fyzika mělké mísy cíle (Matter.js 2D). Pasti používají vlastní disk v trapHole.ts. */

export type HoleDef = { x: number; y: number; r: number };

export type BowlParams = {
  influenceRadiusMul: number;
  fastPassSpeed: number;
  pullScale: number;
};

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x1 - x2, y1 - y2);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Hloubka v díře: kladná = střed míčku pod vizuálním okrajem. */
export function holeDepth(distCenter: number, holeR: number, ballRadius: number): number {
  const rim = holeR - ballRadius * 0.55;
  return rim - distCenter;
}

export function isShallowGraze(
  depth: number,
  speed: number,
  ballRadius: number,
  fastPassSpeed: number
): boolean {
  const shallowBand = ballRadius * 0.55;
  return depth >= -shallowBand && depth < ballRadius * 0.25 && speed >= fastPassSpeed * 0.85;
}

export type BowlPullPhase = "idle" | "approach" | "settling" | "completed";

export function computeBowlPull(
  ballX: number,
  ballY: number,
  vx: number,
  vy: number,
  hole: HoleDef,
  ballRadius: number,
  params: BowlParams,
  phase: BowlPullPhase
): { pullFx: number; pullFy: number; depth: number; dist: number; shallow: boolean } {
  const d = dist(ballX, ballY, hole.x, hole.y);
  const depth = holeDepth(d, hole.r, ballRadius);
  const speed = Math.hypot(vx, vy);
  const shallow = isShallowGraze(depth, speed, ballRadius, params.fastPassSpeed);
  const outer = hole.r * params.influenceRadiusMul + ballRadius * 0.35;

  if (d > outer || phase === "completed") {
    return { pullFx: 0, pullFy: 0, depth, dist: d, shallow };
  }

  if (shallow && phase !== "settling") {
    const edge = Math.max(0, 1 - (d - hole.r) / (ballRadius * 1.2));
    const weak = edge * 0.00012;
    const nx = (hole.x - ballX) / (d || 1);
    const ny = (hole.y - ballY) / (d || 1);
    return { pullFx: nx * weak, pullFy: ny * weak, depth, dist: d, shallow: true };
  }

  const t = clamp((outer - d) / (outer - hole.r * 0.15), 0, 1);
  const depthBoost = clamp((depth + ballRadius * 0.2) / (hole.r * 0.85), 0, 1.2);
  const strength = params.pullScale * 0.0002 * (t * t) * (0.35 + depthBoost);
  const nx = (hole.x - ballX) / (d || 1);
  const ny = (hole.y - ballY) / (d || 1);

  if (phase === "settling") {
    return { pullFx: nx * strength * 1.55, pullFy: ny * strength * 1.55, depth, dist: d, shallow: false };
  }

  return { pullFx: nx * strength, pullFy: ny * strength, depth, dist: d, shallow: false };
}
