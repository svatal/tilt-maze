/**
 * Lokální sklon podlahy (nepropadné regiony). Fyzika sdílí miskový model z holeSlope.
 */

import {
  bowlLocalTiltMagnitude,
  bowlLocalTiltToward,
  composeBoardAndHoleTilts,
  type BowlTiltProfile,
  type HoleDef
} from "./holeSlope";

export type FloorSlopeKind = "basin" | "hill";

export type FloorSlopeCircle = {
  shape: "circle";
  cx: number;
  cy: number;
  r: number;
  kind: FloorSlopeKind;
};

export type FloorSlopeRect = {
  shape: "rect";
  cx: number;
  cy: number;
  w: number;
  h: number;
  kind: FloorSlopeKind;
};

export type FloorSlopeRegion = FloorSlopeCircle | FloorSlopeRect;

/** Slabší než past/cíl — bez trigger zóny (triggerFrac 0). */
export const FLOOR_BASIN_PROFILE: BowlTiltProfile = { rimAngleDeg: 32, triggerFrac: 0 };
export const FLOOR_HILL_PROFILE: BowlTiltProfile = { rimAngleDeg: 28, triggerFrac: 0 };

function profileForKind(kind: FloorSlopeKind): BowlTiltProfile {
  return kind === "basin" ? FLOOR_BASIN_PROFILE : FLOOR_HILL_PROFILE;
}

export function ballInCircleSlope(ballX: number, ballY: number, slope: FloorSlopeCircle): boolean {
  return Math.hypot(ballX - slope.cx, ballY - slope.cy) <= slope.r;
}

export function ballInRectSlope(ballX: number, ballY: number, slope: FloorSlopeRect): boolean {
  const hw = slope.w / 2;
  const hh = slope.h / 2;
  return Math.abs(ballX - slope.cx) <= hw && Math.abs(ballY - slope.cy) <= hh;
}

export function ballInFloorSlope(ballX: number, ballY: number, slope: FloorSlopeRegion): boolean {
  return slope.shape === "circle" ? ballInCircleSlope(ballX, ballY, slope) : ballInRectSlope(ballX, ballY, slope);
}

function circleAsBowl(slope: FloorSlopeCircle): HoleDef {
  return { cx: slope.cx, cy: slope.cy, r: slope.r };
}

/** Obdélník aproximujeme elipsou se stejným středem; poloměr = min(w,h)/2. */
function rectAsBowl(slope: FloorSlopeRect): { bowl: HoleDef; relScaleX: number; relScaleY: number } {
  const rx = slope.w / 2;
  const ry = slope.h / 2;
  const r = Math.min(rx, ry);
  return { bowl: { cx: slope.cx, cy: slope.cy, r }, relScaleX: rx / r, relScaleY: ry / r };
}

function rectEffectiveDistance(ballX: number, ballY: number, slope: FloorSlopeRect): number {
  const { bowl, relScaleX, relScaleY } = rectAsBowl(slope);
  const nx = (ballX - bowl.cx) / (bowl.r * relScaleX);
  const ny = (ballY - bowl.cy) / (bowl.r * relScaleY);
  const norm = Math.hypot(nx, ny);
  return norm * bowl.r;
}

export function floorSlopeLocalTilt(
  ballX: number,
  ballY: number,
  slope: FloorSlopeRegion
): { ax: number; ay: number } {
  if (!ballInFloorSlope(ballX, ballY, slope)) return { ax: 0, ay: 0 };

  const profile = profileForKind(slope.kind);
  const towardCenter = slope.kind === "basin";

  if (slope.shape === "circle") {
    return bowlLocalTiltToward(ballX, ballY, circleAsBowl(slope), profile, towardCenter);
  }

  const { bowl } = rectAsBowl(slope);
  const d = rectEffectiveDistance(ballX, ballY, slope);
  if (d > bowl.r) return { ax: 0, ay: 0 };

  const dx = bowl.cx - ballX;
  const dy = bowl.cy - ballY;
  const dist = Math.hypot(dx, dy);
  const ux = dist > 1e-6 ? dx / dist : 0;
  const uy = dist > 1e-6 ? dy / dist : 0;
  const mag = bowlLocalTiltMagnitude(d, bowl.r, profile);
  const sign = towardCenter ? 1 : -1;
  return { ax: ux * mag * sign, ay: uy * mag * sign };
}

export function composeBoardHoleAndFloorTilts(
  boardAx: number,
  boardAy: number,
  ballX: number,
  ballY: number,
  goal: HoleDef | null,
  trapHoles: HoleDef[],
  floorSlopes: FloorSlopeRegion[]
): { ax: number; ay: number } {
  let { ax, ay } = composeBoardAndHoleTilts(boardAx, boardAy, ballX, ballY, goal, trapHoles);
  for (const s of floorSlopes) {
    if (!ballInFloorSlope(ballX, ballY, s)) continue;
    const l = floorSlopeLocalTilt(ballX, ballY, s);
    ax += l.ax;
    ay += l.ay;
  }
  return { ax, ay };
}
