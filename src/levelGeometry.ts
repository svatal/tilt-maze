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
const FRAME_TOP = 32;
const FRAME_BOTTOM = 608;
const FRAME_H_SPAN = FRAME_BOTTOM - FRAME_TOP;

export const PERIMETER_WALLS: WallDef[] = [
  { cx: 180, cy: 20, w: 296, h: 24 },
  { cx: 180, cy: 620, w: 296, h: 24 },
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
