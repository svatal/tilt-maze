/**
 * Lokální příspěvek sklonu u děr (mělká miska) — čistá 2D aproximace.
 * Ve 2D projekci má svislá stěna nulovou šířku; sklon má konečnou šířku
 * (viditelná díra + plynulý přechod). Jednotky = board tilt před FORCE_MULT.
 */

export type HoleDef = { cx: number; cy: number; r: number };

const HOLE_RIM_PAD = 6;

/** Silnější tah ke středu; u středu misky nejvíc, u okraje slabě. */
const HOLE_PEAK_TILT = 1.38;

/** Animace propadu/výhry jen když střed kuličky vstoupí do tohoto jádra u středu díry. */
const TRAP_CORE_FRAC = 0.45;
const GOAL_CORE_FRAC = 0.52;

export const HOLE_CORE_FRAC = TRAP_CORE_FRAC;

export function holeCoreRadius(visibleR: number, kind: "goal" | "trap" = "trap"): number {
  const frac = kind === "goal" ? GOAL_CORE_FRAC : TRAP_CORE_FRAC;
  return visibleR * frac;
}

export function holeInfluenceOuter(visibleR: number): number {
  return visibleR + HOLE_RIM_PAD;
}

/**
 * Plynulý profil misky: směr ke středu, síla roste ke středu.
 */
export function holeLocalTilt(ballX: number, ballY: number, hole: HoleDef): { ax: number; ay: number } {
  const dx = hole.cx - ballX;
  const dy = hole.cy - ballY;
  const dist = Math.hypot(dx, dy);
  const outer = holeInfluenceOuter(hole.r);
  if (dist >= outer || outer <= 0) return { ax: 0, ay: 0 };

  const towardX = dist > 1e-6 ? dx / dist : 0;
  const towardY = dist > 1e-6 ? dy / dist : 0;
  const u = dist / outer;
  const profile = (1 - u) * (1 - u);
  const mag = HOLE_PEAK_TILT * profile;
  return { ax: towardX * mag, ay: towardY * mag };
}

export function ballInHoleInfluence(ballX: number, ballY: number, hole: HoleDef): boolean {
  return Math.hypot(ballX - hole.cx, ballY - hole.cy) < holeInfluenceOuter(hole.r);
}

/** Střed kuličky uvnitř kotouče daného poloměru. */
export function ballCenterInDisk(
  ballX: number,
  ballY: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  return Math.hypot(ballX - cx, ballY - cy) <= radius;
}

export function segmentCrossesDisk(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  if (ballCenterInDisk(x0, y0, cx, cy, radius)) return true;
  if (ballCenterInDisk(x1, y1, cx, cy, radius)) return true;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return ballCenterInDisk(x1, y1, cx, cy, radius);

  let t = -(fx * dx + fy * dy) / a;
  t = Math.max(0, Math.min(1, t));
  const px = x0 + t * dx;
  const py = y0 + t * dy;
  return Math.hypot(px - cx, py - cy) <= radius;
}

/** Vstup / průlet do viditelné misky (pro zarážku pasti). */
export function entersVisibleBowl(
  x0: number | null,
  y0: number | null,
  x1: number,
  y1: number,
  hole: HoleDef
): boolean {
  if (ballCenterInDisk(x1, y1, hole.cx, hole.cy, hole.r)) return true;
  if (x0 == null || y0 == null) return false;
  return segmentCrossesDisk(x0, y0, x1, y1, hole.cx, hole.cy, hole.r);
}

/** Terminální animace: střed v jádru nebo rychlý průlet jádrem mezi snímky. */
export function reachesHoleCore(
  x0: number | null,
  y0: number | null,
  x1: number,
  y1: number,
  hole: HoleDef,
  kind: "goal" | "trap" = "trap"
): boolean {
  const core = holeCoreRadius(hole.r, kind);
  if (ballCenterInDisk(x1, y1, hole.cx, hole.cy, core)) return true;
  if (x0 == null || y0 == null) return false;
  return segmentCrossesDisk(x0, y0, x1, y1, hole.cx, hole.cy, core);
}

export function composeBoardAndHoleTilts(
  boardAx: number,
  boardAy: number,
  ballX: number,
  ballY: number,
  goal: HoleDef | null,
  extraBowls: HoleDef[]
): { ax: number; ay: number } {
  let ax = boardAx;
  let ay = boardAy;
  if (goal && ballInHoleInfluence(ballX, ballY, goal)) {
    const l = holeLocalTilt(ballX, ballY, goal);
    ax += l.ax;
    ay += l.ay;
  }
  for (const h of extraBowls) {
    if (ballInHoleInfluence(ballX, ballY, h)) {
      const l = holeLocalTilt(ballX, ballY, h);
      ax += l.ax;
      ay += l.ay;
    }
  }
  return { ax, ay };
}
