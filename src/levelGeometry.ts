/**
 * Společná geometrie desky a pomocné kontroly úrovní (testy, validace).
 */

import { BALL_RADIUS, DESIGN_HEIGHT, DESIGN_WIDTH } from "./constants";
import {
  hasClearStraightCorridor,
  isFreePoint,
  maxFreeVerticalRun,
  pathToGoalLengthRatio
} from "./levelSolvability";
import type { LevelDef, WallDef } from "./levels";

/** Vnitřní hrany obvodu (souřadnice odpovídají středům segmentů). */
export const FRAME_TOP = 32;
export const FRAME_BOTTOM = 608;
export const FRAME_INNER_LEFT = 32;
export const FRAME_INNER_RIGHT = 328;
const FRAME_H_SPAN = FRAME_BOTTOM - FRAME_TOP;

/** Kulička nesmí protéct štěrbinou mezi tvářemi zdí (viz testy úrovní). */
export const NARROW_FACE_GAP_MAX = 2 * BALL_RADIUS + 4;

/** Vodorovné úseky do rohů (svislé segmenty končí na y=32 / y=608). */
const PERIMETER_H_SPAN = 344;

export const PERIMETER_WALLS: WallDef[] = [
  { cx: 180, cy: 20, w: PERIMETER_H_SPAN, h: 24 },
  { cx: 180, cy: 620, w: PERIMETER_H_SPAN, h: 24 },
  { cx: 20, cy: 320, w: 24, h: FRAME_H_SPAN },
  { cx: 340, cy: 320, w: 24, h: FRAME_H_SPAN }
];

const WALL_EPS = 0.5;
/** Min. mezera mezi obrysem pasti a obdélníkem zdi (logická kolize — ne vizuální halo). */
const TRAP_WALL_CLEARANCE = 1;

export function wallKey(w: WallDef): string {
  return `${w.cx}|${w.cy}|${w.w}|${w.h}`;
}

export function isPerimeterWall(w: WallDef): boolean {
  return PERIMETER_WALLS.some(
    (p) =>
      Math.abs(p.cx - w.cx) < WALL_EPS &&
      Math.abs(p.cy - w.cy) < WALL_EPS &&
      Math.abs(p.w - w.w) < WALL_EPS &&
      Math.abs(p.h - w.h) < WALL_EPS
  );
}

export function interiorWalls(lvl: LevelDef): WallDef[] {
  return lvl.walls.filter((w) => !isPerimeterWall(w));
}

const TYPICAL_WALL_THICKNESS = 14;

function wallAabbOverlapDepth(a: WallDef, b: WallDef): { ox: number; oy: number } | null {
  const hwA = a.w / 2;
  const hhA = a.h / 2;
  const hwB = b.w / 2;
  const hhB = b.h / 2;
  const ox = Math.min(a.cx + hwA, b.cx + hwB) - Math.max(a.cx - hwA, b.cx - hwB);
  const oy = Math.min(a.cy + hhA, b.cy + hhB) - Math.max(a.cy - hhA, b.cy - hhB);
  if (ox <= 0.5 || oy <= 0.5) return null;
  return { ox, oy };
}

/** Vnitřní zdi nesmí do sebe přesahovat více než jako čisté T-spoje (≈ tloušťka segmentu). */
export function interiorWallOverlapViolations(lvl: LevelDef): string[] {
  const walls = interiorWalls(lvl);
  const viol: string[] = [];
  const T = TYPICAL_WALL_THICKNESS;
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const o = wallAabbOverlapDepth(walls[i], walls[j]);
      if (!o) continue;
      const m = Math.max(o.ox, o.oy);
      const n = Math.min(o.ox, o.oy);
      if (m > T + 0.5 && n > T / 2 + 0.5) {
        viol.push(
          `přesah ${o.ox.toFixed(1)}×${o.oy.toFixed(1)} mezi (${walls[i].cx},${walls[i].cy}) a (${walls[j].cx},${walls[j].cy})`
        );
      }
    }
  }
  return viol;
}

function wallBox(w: WallDef) {
  return { l: w.cx - w.w / 2, r: w.cx + w.w / 2, t: w.cy - w.h / 2, b: w.cy + w.h / 2 };
}

function axisOverlap(a: number, b: number, c: number, d: number): number {
  return Math.min(b, d) - Math.max(a, c);
}

function gapChannelBlocked(walls: WallDef[], rect: { l: number; r: number; t: number; b: number }, skip: WallDef[]): boolean {
  if (rect.r - rect.l < 0.5 || rect.b - rect.t < 0.5) return true;
  for (const w of walls) {
    if (skip.includes(w)) continue;
    const b = wallBox(w);
    if (axisOverlap(b.l, b.r, rect.l, rect.r) > 0 && axisOverlap(b.t, b.b, rect.t, rect.b) > 0) {
      return true;
    }
  }
  return false;
}

function isHorizontalSlab(w: WallDef): boolean {
  return w.w > w.h + WALL_EPS;
}

function isVerticalSlab(w: WallDef): boolean {
  return w.h >= w.w - WALL_EPS;
}

/**
 * Štěrbiny mezi tvářemi zdí (vnitřní i obvod), kde by se kulička (⌀ 2r) nevešla,
 * ale štěrbina je úzká — logická chyba, ne záměrná chodba (ty jsou ≥ DOOR/GAP).
 */
export function narrowWallFaceGapViolations(lvl: LevelDef): string[] {
  const walls = lvl.walls;
  const viol: string[] = [];
  const maxG = NARROW_FACE_GAP_MAX;
  const hz = walls.filter(isHorizontalSlab);
  const vz = walls.filter(isVerticalSlab);

  const push = (msg: string, rect: { l: number; r: number; t: number; b: number }, skip: WallDef[]) => {
    if (!gapChannelBlocked(walls, rect, skip)) viol.push(msg);
  };

  for (const v of vz) {
    const vb = wallBox(v);
    for (const h of hz) {
      const hb = wallBox(h);
      const xOv = axisOverlap(vb.l, vb.r, hb.l, hb.r);
      if (xOv < 6) continue;
      const gBelow = hb.t - vb.b;
      if (gBelow > WALL_EPS && gBelow < maxG) {
        push(
          `svislá–spodní vodorovná mezera ${gBelow.toFixed(1)}px u (${v.cx},${v.cy})↔(${h.cx},${h.cy})`,
          { l: Math.max(vb.l, hb.l), r: Math.min(vb.r, hb.r), t: vb.b, b: hb.t },
          [v, h]
        );
      }
      const gAbove = vb.t - hb.b;
      if (gAbove > WALL_EPS && gAbove < maxG) {
        push(
          `vodorovná–horní svislá mezera ${gAbove.toFixed(1)}px u (${h.cx},${h.cy})↔(${v.cx},${v.cy})`,
          { l: Math.max(vb.l, hb.l), r: Math.min(vb.r, hb.r), t: hb.b, b: vb.t },
          [v, h]
        );
      }
    }
  }

  for (let i = 0; i < hz.length; i++) {
    for (let j = i + 1; j < hz.length; j++) {
      if (Math.abs(hz[i].cy - hz[j].cy) > 3) continue;
      const a = wallBox(hz[i]);
      const b = wallBox(hz[j]);
      let g = 0;
      let rect: { l: number; r: number; t: number; b: number };
      if (b.l > a.r) {
        g = b.l - a.r;
        rect = { l: a.r, r: b.l, t: Math.min(a.t, b.t), b: Math.max(a.b, b.b) };
      } else if (a.l > b.r) {
        g = a.l - b.r;
        rect = { l: b.r, r: a.l, t: Math.min(a.t, b.t), b: Math.max(a.b, b.b) };
      } else continue;
      if (g > WALL_EPS && g < maxG) {
        push(
          `vodorovná–vodorovná mezera ${g.toFixed(1)}px u (${hz[i].cx},${hz[i].cy})↔(${hz[j].cx},${hz[j].cy})`,
          rect,
          [hz[i], hz[j]]
        );
      }
    }
  }

  for (const h of hz) {
    const hb = wallBox(h);
    for (const v of vz) {
      const vb = wallBox(v);
      const yOv = axisOverlap(hb.t, hb.b, vb.t, vb.b);
      if (yOv < 6) continue;
      const gR = vb.l - hb.r;
      if (gR > WALL_EPS && gR < maxG) {
        push(
          `konec vodorovné–svislá mezera ${gR.toFixed(1)}px u (${h.cx},${h.cy})↔(${v.cx},${v.cy})`,
          { l: hb.r, r: vb.l, t: Math.max(hb.t, vb.t), b: Math.min(hb.b, vb.b) },
          [h, v]
        );
      }
      const gL = hb.l - vb.r;
      if (gL > WALL_EPS && gL < maxG) {
        push(
          `svislá–konec vodorovné mezera ${gL.toFixed(1)}px u (${v.cx},${v.cy})↔(${h.cx},${h.cy})`,
          { l: vb.r, r: hb.l, t: Math.max(hb.t, vb.t), b: Math.min(hb.b, vb.b) },
          [v, h]
        );
      }
    }
  }

  return viol;
}

/** Volný bod s rezervou pro kuličku — stejná logika jako levelSolvability (bez importu cyklu). */
export function pointInWall(px: number, py: number, radius: number, walls: WallDef[]): boolean {
  const MARGIN = 2;
  const rBall = radius + MARGIN;
  if (px < rBall || px > DESIGN_WIDTH - rBall || py < rBall || py > DESIGN_HEIGHT - rBall) {
    return true;
  }
  for (const w of walls) {
    const hw = w.w / 2;
    const hh = w.h / 2;
    const dx = Math.abs(px - w.cx) - hw;
    const dy = Math.abs(py - w.cy) - hh;
    const adx = Math.max(0, dx);
    const ady = Math.max(0, dy);
    if (Math.hypot(adx, ady) < rBall) return true;
  }
  return false;
}

/** Past (kruh) protíná obdélník zdi, pokud vzdálenost středů < r + tolerance. */
export function trapOverlapsWall(
  trap: { x: number; y: number; r: number },
  wall: WallDef,
  clearance: number = TRAP_WALL_CLEARANCE
): boolean {
  const hw = wall.w / 2;
  const hh = wall.h / 2;
  const dx = Math.abs(trap.x - wall.cx) - hw;
  const dy = Math.abs(trap.y - wall.cy) - hh;
  const adx = Math.max(0, dx);
  const ady = Math.max(0, dy);
  return Math.hypot(adx, ady) < trap.r + clearance;
}

export function trapOverlapsAnyWall(lvl: LevelDef, clearance: number = TRAP_WALL_CLEARANCE): boolean {
  for (const t of lvl.traps) {
    for (const w of lvl.walls) {
      if (trapOverlapsWall(t, w, clearance)) return true;
    }
  }
  return false;
}

export function pointInTrap(px: number, py: number, radius: number, lvl: LevelDef): boolean {
  const MARGIN = 2;
  for (const t of lvl.traps) {
    if (Math.hypot(px - t.x, py - t.y) < radius + t.r + MARGIN) return true;
  }
  return false;
}

export function isSpawnAndGoalClear(lvl: LevelDef, ballRadius: number = BALL_RADIUS): boolean {
  if (pointInWall(lvl.start.x, lvl.start.y, ballRadius, lvl.walls)) return false;
  if (pointInTrap(lvl.start.x, lvl.start.y, ballRadius, lvl)) return false;
  if (pointInWall(lvl.goal.x, lvl.goal.y, lvl.goal.r + ballRadius, lvl.walls)) return false;
  if (pointInTrap(lvl.goal.x, lvl.goal.y, lvl.goal.r + ballRadius, lvl)) return false;
  for (const t of lvl.traps) {
    if (Math.hypot(lvl.goal.x - t.x, lvl.goal.y - t.y) < lvl.goal.r + t.r + 4) return false;
  }
  return true;
}

/** Úroveň 1: jen obvod, cíl v „vzdálené“ polovině, ne roh, ne střed desky. */
export function validateLevel1Shape(lvl: LevelDef): string | null {
  if (lvl.id !== 1) return null;
  if (lvl.traps.length > 0) return "úroveň 1 nesmí mít pasti";
  if (interiorWalls(lvl).length > 0) return "úroveň 1 smí mít jen obvodové zdi";
  const midY = DESIGN_HEIGHT / 2;
  if (!(lvl.start.y > midY && lvl.goal.y < midY)) {
    return "cíl musí být v horní polovině a start v dolní (míření přes desku)";
  }
  const cornerDist = 52;
  const nearLeft = lvl.goal.x < cornerDist;
  const nearRight = lvl.goal.x > DESIGN_WIDTH - cornerDist;
  const nearTop = lvl.goal.y < cornerDist;
  const nearBottom = lvl.goal.y > DESIGN_HEIGHT - cornerDist;
  if ((nearLeft && nearTop) || (nearRight && nearTop) || (nearLeft && nearBottom) || (nearRight && nearBottom)) {
    return "cíl nesmí být v rohu";
  }
  const centerR = 70;
  if (Math.hypot(lvl.goal.x - DESIGN_WIDTH / 2, lvl.goal.y - DESIGN_HEIGHT / 2) < centerR) {
    return "cíl nesmí být uprostřed desky";
  }
  return null;
}

/** Úrovně 2–5: žádné pasti. */
export function validateWallsOnlyBand(lvl: LevelDef): string | null {
  if (lvl.id < 2 || lvl.id > 5) return null;
  if (lvl.traps.length > 0) return `úroveň ${lvl.id} (2–5) nesmí mít pasti`;
  return null;
}

/** Úroveň 10: jen pasti uvnitř, žádné vnitřní zdi. */
export function validateLevel10Slalom(lvl: LevelDef): string | null {
  if (lvl.id !== 10) return null;
  if (interiorWalls(lvl).length > 0) return "úroveň 10 nesmí mít vnitřní zdi";
  if (lvl.traps.length < 4) return "úroveň 10 potřebuje více pastí pro slalom";
  return null;
}

export function validateLevelSet(levels: LevelDef[]): void {
  if (levels.length !== 10) {
    throw new Error(`Očekáváno 10 úrovní, je jich ${levels.length}.`);
  }
  for (const lvl of levels) {
    const errs = [
      validateLevel1Shape(lvl),
      validateWallsOnlyBand(lvl),
      validateLevel10Slalom(lvl)
    ].filter(Boolean);
    if (errs.length) {
      throw new Error(`Úroveň ${lvl.id}: ${errs.join("; ")}`);
    }
    if (!isSpawnAndGoalClear(lvl)) {
      throw new Error(`Úroveň ${lvl.id}: start nebo cíl koliduje se zdí/pastí.`);
    }
    if (trapOverlapsAnyWall(lvl)) {
      throw new Error(`Úroveň ${lvl.id}: past protíná zeď.`);
    }
    if (lvl.id >= 2 && hasClearStraightCorridor(lvl)) {
      throw new Error(`Úroveň ${lvl.id}: přímá start–cíl trajektorie není blokovaná.`);
    }
    if (lvl.id >= 3 && lvl.id <= 5) {
      const ratio = pathToGoalLengthRatio(lvl);
      if (ratio == null || ratio < 1.6) {
        throw new Error(`Úroveň ${lvl.id}: BFS cesta / přímka ${ratio?.toFixed(2) ?? "—"} < 1.6.`);
      }
      let centerFree = 0;
      for (let y = 130; y <= 580; y += 22) {
        if (isFreePoint(DESIGN_WIDTH / 2, y, BALL_RADIUS, lvl)) centerFree++;
      }
      if (centerFree > 12) {
        throw new Error(`Úroveň ${lvl.id}: příliš volná středová svislá šachta (${centerFree} vzorků).`);
      }
    }
    if (lvl.id === 10) {
      const maxEdge = Math.max(
        maxFreeVerticalRun(lvl, 51, 165, 500, BALL_RADIUS, 2),
        maxFreeVerticalRun(lvl, 309, 165, 500, BALL_RADIUS, 2)
      );
      const ballPass = 2 * BALL_RADIUS + 4;
      if (maxEdge >= ballPass) {
        throw new Error(`Úroveň 10: volný úsek u kraje ${maxEdge.toFixed(0)}px ≥ ${ballPass}px.`);
      }
    }
  }
}
