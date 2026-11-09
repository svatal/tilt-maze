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

function bfsTraverse(
  lvl: LevelDef,
  ballRadius: number,
  onGoal?: (ix: number, iy: number, dist: number) => boolean,
  cell = CELL
): { solved: boolean; dist: number | null } {
  const goalReach = lvl.goal.r + ballRadius + 4;
  const grid = buildBfsGrid(lvl, ballRadius, cell);
  if (!grid) return { solved: false, dist: null };

  const { xs, ys, startCells } = grid;
  const key = (ix: number, iy: number) => `${ix},${iy}`;
  const dist = new Map<string, number>();
  const q: { ix: number; iy: number }[] = [];

  for (const c of startCells) {
    const k = key(c.ix, c.iy);
    if (!dist.has(k)) {
      dist.set(k, 0);
      q.push(c);
    }
  }

  while (q.length) {
    const cur = q.shift()!;
    const px = xs[cur.ix];
    const py = ys[cur.iy];
    const curD = dist.get(key(cur.ix, cur.iy)) ?? 0;

    if (Math.hypot(px - lvl.goal.x, py - lvl.goal.y) <= goalReach) {
      if (onGoal?.(cur.ix, cur.iy, curD)) return { solved: true, dist: curD };
      return { solved: true, dist: curD };
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
      q.push({ ix: nix, iy: niy });
    }
  }
  return { solved: false, dist: null };
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
