/**
 * Kontrola průchodnosti: grid BFS od startu k cíli s rezervou pro poloměr kuličky.
 */

import { BALL_RADIUS } from "./constants";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./constants";
import type { LevelDef } from "./levels";

const MARGIN = 2;
const CELL = 6;
const SEGMENT_SAMPLES = 6;

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

/**
 * BFS na mřížce středů buněk. Vrací true, pokud existuje cesta z oblasti startu k cíli.
 */
export function isLevelSolvable(lvl: LevelDef, ballRadius: number = BALL_RADIUS): boolean {
  const goalReach = lvl.goal.r + ballRadius + 4;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = CELL / 2; x < DESIGN_WIDTH; x += CELL) xs.push(x);
  for (let y = CELL / 2; y < DESIGN_HEIGHT; y += CELL) ys.push(y);

  const key = (ix: number, iy: number) => `${ix},${iy}`;
  const startSeedR = CELL * 1.2;

  const q: { ix: number; iy: number }[] = [];
  const seen = new Set<string>();

  for (let iy = 0; iy < ys.length; iy++) {
    for (let ix = 0; ix < xs.length; ix++) {
      const px = xs[ix];
      const py = ys[iy];
      if (!isFreePoint(px, py, ballRadius, lvl)) continue;
      if (Math.hypot(px - lvl.start.x, py - lvl.start.y) <= startSeedR) {
        const k = key(ix, iy);
        if (!seen.has(k)) {
          seen.add(k);
          q.push({ ix, iy });
        }
      }
    }
  }

  if (q.length === 0) return false;

  const neigh = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ];

  while (q.length) {
    const cur = q.shift()!;
    const px = xs[cur.ix];
    const py = ys[cur.iy];
    if (Math.hypot(px - lvl.goal.x, py - lvl.goal.y) <= goalReach) return true;
    for (const [dx, dy] of neigh) {
      const nix = cur.ix + dx;
      const niy = cur.iy + dy;
      if (nix < 0 || niy < 0 || nix >= xs.length || niy >= ys.length) continue;
      const k = key(nix, niy);
      if (seen.has(k)) continue;
      const nx = xs[nix];
      const ny = ys[niy];
      if (!isFreePoint(nx, ny, ballRadius, lvl)) continue;
      if (!canTraverse({ x: px, y: py }, { x: nx, y: ny }, ballRadius, lvl)) continue;
      seen.add(k);
      q.push({ ix: nix, iy: niy });
    }
  }

  return false;
}

export function assertAllLevelsSolvable(levels: LevelDef[]): void {
  for (const l of levels) {
    if (!isLevelSolvable(l)) {
      throw new Error(`Úroveň ${l.id} (${l.name}) není BFS řešitelná s poloměrem ${BALL_RADIUS}.`);
    }
  }
}
