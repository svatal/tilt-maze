/**
 * Lokální příspěvek sklonu u cílové díry (mělká miska) — čistá 2D aproximace.
 * Ve 2D projekci má svislá stěna nulovou šířku; místo toho je konečná šířka
 * sklonu (vnitřní kotouč + plynulý přechod k okraji viditelné díry).
 * Jednotky jsou stejné jako u board tiltu (složky ax/ay před FORCE_MULT).
 */

export type GoalHole = { cx: number; cy: number; r: number };

/** Vnější okraj vlivu misky (pixelů za viditelným okrajem díry). */
const GOAL_RIM_PAD = 6;

/** Maximální lokální tilt u středu misky (přičítá se k board tiltu). */
const GOAL_PEAK_TILT = 0.95;

/**
 * Plynulý profil: 0 na vnějším okraji vlivu, GOAL_PEAK_TILT ve středu.
 * Směr směřuje ke středu díry (kulička se „kutálí“ dovnitř).
 */
export function goalLocalTilt(ballX: number, ballY: number, goal: GoalHole): { ax: number; ay: number } {
  const dx = goal.cx - ballX;
  const dy = goal.cy - ballY;
  const dist = Math.hypot(dx, dy);
  const outer = goal.r + GOAL_RIM_PAD;
  if (dist >= outer || outer <= 0) return { ax: 0, ay: 0 };

  const towardX = dist > 1e-6 ? dx / dist : 0;
  const towardY = dist > 1e-6 ? dy / dist : 0;
  const u = dist / outer;
  const profile = (1 - u) * (1 - u);
  const mag = GOAL_PEAK_TILT * profile;
  return { ax: towardX * mag, ay: towardY * mag };
}

/** Střed kuličky uvnitř viditelného kotouče (hřídel = střed, ne overlap senzoru). */
export function ballCenterInDisk(
  ballX: number,
  ballY: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  return Math.hypot(ballX - cx, ballY - cy) <= radius;
}

/**
 * Zachytí vstup středu do kotouče mezi dvěma fyzikálními snímky (rychlý průlet).
 */
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

/** Složení board tiltu a lokální misky (lokální se nepřeskakuje globálním klipem v tiltMapping). */
export function composeBoardAndGoalTilt(
  boardAx: number,
  boardAy: number,
  ballX: number,
  ballY: number,
  goal: GoalHole | null
): { ax: number; ay: number } {
  if (!goal) return { ax: boardAx, ay: boardAy };
  const local = goalLocalTilt(ballX, ballY, goal);
  return { ax: boardAx + local.ax, ay: boardAy + local.ay };
}
