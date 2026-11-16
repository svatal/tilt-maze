/**
 * Kontrola průchodnosti: grid BFS od startu k cíli s rezervou pro poloměr kuličky.
 * Dokládá existenci cesty v diskretizovaném modelu — ne subjektivní obtížnost hry na zařízení.
 */

import { BALL_RADIUS } from "./constants";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./constants";
import type { LevelDef } from "./levels";

const MARGIN = 2;
/** Hrubá mřížka pro rychlou kontrolu; detailnější pro měření délky trasy. */
const CELL = 6;
const CELL_PATH = 4;
const SEGMENT_SAMPLES = 6;
const STRAIGHT_SAMPLES = 40;

/** Vzdálenost bodu od obdélníka (střed, půlšířka, půlvýška); 0 uvnitř. */
function pointRectDist(px: number, py: number, cx: number, cy: number, hw: number, hh: number): number {
  const dx = Math.abs(px - cx) - hw;
  const dy = Math.abs(py - cy) - hh;
  const adx = Math.max(0, dx);
  const ady = Math.max(0, dy);
  return Math.hypot(adx, ady);
}

function circleWallBlocked(px: number, py: number, radius: number, walls: LevelDef["walls"]): boolean {
  if (px < radius + MARGIN || px > DESIGN_WIDTH - radius - MARGIN || py < radius + MARGIN || py > DESIGN_HEIGHT - radius - MARGIN) {
    return true;
  }
  const rBall = radius + MARGIN;
  for (const w of walls) {
    const hw = w.w / 2;
    const hh = w.h / 2;
    const d = pointRectDist(px, py, w.cx, w.cy, hw, hh);
    if (d < rBall) return true;
  }
  return false;
}

function circleTrapOverlaps(px: number, py: number, radius: number, lvl: LevelDef): boolean {
  for (const t of lvl.traps) {
    const d = Math.hypot(px - t.x, py - t.y);
    if (d < radius + t.r + MARGIN) return true;
  }
  return false;
}

/** Je bod ve „volném“ prostoru (kulička se sem vejde a není v díře)? */
export function isFreePoint(px: number, py: number, radius: number, lvl: LevelDef): boolean {
  if (circleWallBlocked(px, py, radius, lvl.walls)) return false;
  if (circleTrapOverlaps(px, py, radius, lvl)) return false;
  return true;
}

/** Je bezpečný přechod kuličky mezi dvěma blízkými body (segment nesmí protínat zdi). */
function canTraverse(a: { x: number; y: number }, b: { x: number; y: number }, radius: number, lvl: LevelDef): boolean {
  for (let s = 0; s <= SEGMENT_SAMPLES; s++) {
    const t = s / SEGMENT_SAMPLES;
    const px = a.x + (b.x - a.x) * t;
    const py = a.y + (b.y - a.y) * t;
    if (!isFreePoint(px, py, radius, lvl)) return false;
  }
  return true;
}

type BfsGrid = { xs: number[]; ys: number[]; startCells: { ix: number; iy: number }[] };

function buildBfsGrid(lvl: LevelDef, ballRadius: number, cell = CELL): BfsGrid | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = cell / 2; x < DESIGN_WIDTH; x += cell) xs.push(x);
  for (let y = cell / 2; y < DESIGN_HEIGHT; y += cell) ys.push(y);

  const startSeedR = cell * 1.2;
  const startCells: { ix: number; iy: number }[] = [];
  for (let iy = 0; iy < ys.length; iy++) {
    for (let ix = 0; ix < xs.length; ix++) {
      const px = xs[ix];
      const py = ys[iy];
      if (!isFreePoint(px, py, ballRadius, lvl)) continue;
      if (Math.hypot(px - lvl.start.x, py - lvl.start.y) <= startSeedR) {
        startCells.push({ ix, iy });
      }
    }
  }
  if (!startCells.length) return null;
  return { xs, ys, startCells };
}

const NEIGH = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
] as const;

type BfsResult = {
  solved: boolean;
  dist: number | null;
  parent?: Map<string, string | null>;
  goalKey?: string;
  xs?: number[];
  ys?: number[];
};

function bfsTraverse(
  lvl: LevelDef,
  ballRadius: number,
  onGoal?: (ix: number, iy: number, dist: number) => boolean,
  cell = CELL,
  recordParent = false
): BfsResult {
  const goalReach = lvl.goal.r + ballRadius + 4;
  const grid = buildBfsGrid(lvl, ballRadius, cell);
  if (!grid) return { solved: false, dist: null };

  const { xs, ys, startCells } = grid;
  const key = (ix: number, iy: number) => `${ix},${iy}`;
  const dist = new Map<string, number>();
  const parent = recordParent ? new Map<string, string | null>() : undefined;
  const q: { ix: number; iy: number }[] = [];

  for (const c of startCells) {
    const k = key(c.ix, c.iy);
    if (!dist.has(k)) {
      dist.set(k, 0);
      if (parent) parent.set(k, null);
      q.push(c);
    }
  }

  while (q.length) {
    const cur = q.shift()!;
    const px = xs[cur.ix];
    const py = ys[cur.iy];
    const curD = dist.get(key(cur.ix, cur.iy)) ?? 0;

    if (Math.hypot(px - lvl.goal.x, py - lvl.goal.y) <= goalReach) {
      if (onGoal?.(cur.ix, cur.iy, curD)) {
        return { solved: true, dist: curD, parent, goalKey: key(cur.ix, cur.iy), xs, ys };
      }
      return { solved: true, dist: curD, parent, goalKey: key(cur.ix, cur.iy), xs, ys };
    }

    for (const [dx, dy] of NEIGH) {
      const nix = cur.ix + dx;
      const niy = cur.iy + dy;
      if (nix < 0 || niy < 0 || nix >= xs.length || niy >= ys.length) continue;
      const k = key(nix, niy);
      if (dist.has(k)) continue;
      const nx = xs[nix];
      const ny = ys[niy];
      if (!isFreePoint(nx, ny, ballRadius, lvl)) continue;
      if (!canTraverse({ x: px, y: py }, { x: nx, y: ny }, ballRadius, lvl)) continue;
      const step = Math.hypot(nx - px, ny - py);
      dist.set(k, curD + step);
      if (parent) parent.set(k, key(cur.ix, cur.iy));
      q.push({ ix: nix, iy: niy });
    }
  }
  return { solved: false, dist: null };
}

/** Mezera od okraje kuličky k povrchu zdi (bez logické rezervy BFS). */
export const ROUTE_WALL_SURFACE_CLEARANCE_PX = 6;
export const ROUTE_TRAP_SURFACE_CLEARANCE_PX = 6;
/** Minimální vzdálenost mezi protilehlými stěnami v úžině pro průměr 22 + 6 + 6. */
export const ROUTE_MIN_CORRIDOR_FACE_PX = 34;

function wallSurfaceClearance(px: number, py: number, ballRadius: number, walls: LevelDef["walls"]): number {
  let minD = Number.POSITIVE_INFINITY;
  for (const w of walls) {
    const hw = w.w / 2;
    const hh = w.h / 2;
    const d = pointRectDist(px, py, w.cx, w.cy, hw, hh);
    minD = Math.min(minD, d);
  }
  return minD - ballRadius;
}

function trapSurfaceClearance(px: number, py: number, ballRadius: number, lvl: LevelDef): number {
  let minD = Number.POSITIVE_INFINITY;
  for (const t of lvl.traps) {
    const d = Math.hypot(px - t.x, py - t.y) - t.r;
    minD = Math.min(minD, d);
  }
  return minD - ballRadius;
}

/** Odhad šířky vodorovné „úžiny“ (vzdálenost obličí vlevo/vpravo). */
function horizontalCorridorWidth(px: number, py: number, walls: LevelDef["walls"]): number {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.POSITIVE_INFINITY;
  for (const w of walls) {
    const top = w.cy - w.h / 2;
    const bot = w.cy + w.h / 2;
    if (py < top || py > bot) continue;
    const hw = w.w / 2;
    const innerL = w.cx - hw;
    const innerR = w.cx + hw;
    if (innerL <= px) left = Math.min(left, px - innerR);
    if (innerR >= px) right = Math.min(right, innerL - px);
  }
  if (!Number.isFinite(left) || !Number.isFinite(right)) return Number.POSITIVE_INFINITY;
  return left + right;
}

/** BFS nejkratší trasa prochází obdélníkem (střed kuličky)? */
export function shortestPathVisitsRect(
  lvl: LevelDef,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  ballRadius: number = BALL_RADIUS
): boolean {
  const pts = shortestPathPoints(lvl, ballRadius);
  if (!pts) return false;
  return pts.some((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1);
}

/** V pásmu y všechny vzorky trasy leží vlevo nebo vpravo od koridoru (obchvat)? */
export function shortestPathBypassesRectYBand(
  lvl: LevelDef,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  ballRadius: number = BALL_RADIUS
): boolean {
  const pts = shortestPathPoints(lvl, ballRadius);
  if (!pts) return false;
  const band = pts.filter((p) => p.y >= y0 && p.y <= y1);
  if (!band.length) return false;
  return band.every((p) => p.x < x0 || p.x > x1);
}

export function shortestPathPoints(lvl: LevelDef, ballRadius: number = BALL_RADIUS): { x: number; y: number }[] | null {
  const result = bfsTraverse(lvl, ballRadius, undefined, CELL, true);
  if (!result.solved || !result.parent || !result.goalKey || !result.xs || !result.ys) return null;
  const { parent, goalKey, xs, ys } = result;
  const pts: { x: number; y: number }[] = [];
  let cur: string | null | undefined = goalKey;
  while (cur) {
    const [ix, iy] = cur.split(",").map(Number);
    pts.push({ x: xs[ix], y: ys[iy] });
    cur = parent.get(cur) ?? null;
  }
  pts.reverse();
  return pts;
}

export type PathClearanceAudit = {
  minWallSurfaceClearance: number;
  minTrapSurfaceClearance: number;
  minCorridorFaceWidth: number;
  narrowest: { x: number; y: number; wall: number; trap: number; corridor: number };
  maxFreeRunAtBypass: number;
};

/** Vzorky podél BFS trasy pro kontrolu fyzické průchozosti (ne jen MARGIN v BFS). */
export function pathRouteSamples(lvl: LevelDef, ballRadius: number = BALL_RADIUS): { x: number; y: number }[] {
  const path = shortestPathPoints(lvl, ballRadius + ROUTE_WALL_SURFACE_CLEARANCE_PX);
  if (!path?.length) return [];
  const samples: { x: number; y: number }[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    for (let s = 0; s <= SEGMENT_SAMPLES; s++) {
      const t = s / SEGMENT_SAMPLES;
      samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return samples;
}

export function auditShortestPathClearance(lvl: LevelDef, ballRadius: number = BALL_RADIUS): PathClearanceAudit | null {
  if (!isLevelSolvable(lvl, ballRadius + ROUTE_WALL_SURFACE_CLEARANCE_PX)) return null;
  const samples = pathRouteSamples(lvl, ballRadius);
  if (!samples.length) return null;

  let minWall = Number.POSITIVE_INFINITY;
  let minTrap = Number.POSITIVE_INFINITY;
  let minCorridor = Number.POSITIVE_INFINITY;
  let narrowest = { x: samples[0].x, y: samples[0].y, wall: 0, trap: 0, corridor: 0 };

  for (const { x: px, y: py } of samples) {
    const wall = wallSurfaceClearance(px, py, ballRadius, lvl.walls);
    const trap = trapSurfaceClearance(px, py, ballRadius, lvl);
    const corridor = horizontalCorridorWidth(px, py, lvl.walls);
    if (wall < minWall || trap < minTrap || corridor < minCorridor) {
      narrowest = { x: px, y: py, wall, trap, corridor };
    }
    minWall = Math.min(minWall, wall);
    minTrap = Math.min(minTrap, trap);
    minCorridor = Math.min(minCorridor, corridor);
  }

  return {
    minWallSurfaceClearance: minWall,
    minTrapSurfaceClearance: minTrap,
    minCorridorFaceWidth: minCorridor,
    narrowest,
    maxFreeRunAtBypass: maxFreeVerticalRun(lvl, 46, 120, 560, ballRadius, 2)
  };
}

export function isLevelSolvable(lvl: LevelDef, ballRadius: number = BALL_RADIUS): boolean {
  return bfsTraverse(lvl, ballRadius).solved;
}

/** Přibližná délka nejkratší BFS cesty v pixelech (mřížka + diagonály). */
export function shortestPathLength(lvl: LevelDef, ballRadius: number = BALL_RADIUS): number | null {
  return bfsTraverse(lvl, ballRadius, undefined, CELL_PATH).dist;
}

export function straightLineDistance(lvl: LevelDef): number {
  return Math.hypot(lvl.goal.x - lvl.start.x, lvl.goal.y - lvl.start.y);
}

/** Všechny vzorky na úsečce start→cíl jsou průjezdné (kulička). */
export function hasClearStraightCorridor(lvl: LevelDef, ballRadius: number = BALL_RADIUS): boolean {
  for (let s = 0; s <= STRAIGHT_SAMPLES; s++) {
    const t = s / STRAIGHT_SAMPLES;
    const px = lvl.start.x + (lvl.goal.x - lvl.start.x) * t;
    const py = lvl.start.y + (lvl.goal.y - lvl.start.y) * t;
    if (!isFreePoint(px, py, ballRadius, lvl)) return false;
  }
  return true;
}

/** Nejdelší souvislý volný úsek podél svislé linie x (pro kontrolu objíždění kraje). */
export function maxFreeVerticalRun(
  lvl: LevelDef,
  x: number,
  yMin: number,
  yMax: number,
  ballRadius: number = BALL_RADIUS,
  step = 4
): number {
  let maxRun = 0;
  let run = 0;
  for (let y = yMin; y <= yMax; y += step) {
    if (isFreePoint(x, y, ballRadius, lvl)) {
      run += step;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 0;
    }
  }
  return maxRun;
}

export function pathToGoalLengthRatio(lvl: LevelDef, ballRadius: number = BALL_RADIUS): number | null {
  const path = shortestPathLength(lvl, ballRadius);
  const straight = straightLineDistance(lvl);
  if (path == null || straight < 1) return null;
  return path / straight;
}

export function assertAllLevelsSolvable(levels: LevelDef[]): void {
  for (const l of levels) {
    if (!isLevelSolvable(l)) {
      throw new Error(`Úroveň ${l.id} (${l.name}) není BFS řešitelná s poloměrem ${BALL_RADIUS}.`);
    }
  }
}
