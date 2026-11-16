/**
 * Matter.js collision categories for grade-separated walls (ground / deck).
 * Ball mask switches with runtime layer; wall category is fixed at spawn.
 */

import type { WallDef } from "./levels";
import { isPerimeterWall } from "./levelGeometry";

export type BallLayer = "ground" | "deck";

export const COLLISION_BALL = 0x0001;
export const COLLISION_WALL_GROUND = 0x0002;
export const COLLISION_WALL_DECK = 0x0004;
export const COLLISION_WALL_SHARED = 0x0008;

export type WallLayer = "ground" | "deck" | "shared";

export function wallCollisionLayer(w: WallDef): WallLayer {
  if (isPerimeterWall(w)) return "shared";
  return w.layer ?? "ground";
}

export function wallCollisionCategory(layer: WallLayer): number {
  if (layer === "shared") return COLLISION_WALL_SHARED;
  if (layer === "deck") return COLLISION_WALL_DECK;
  return COLLISION_WALL_GROUND;
}

export function ballCollisionMask(layer: BallLayer): number {
  if (layer === "deck") {
    return COLLISION_WALL_DECK | COLLISION_WALL_SHARED;
  }
  return COLLISION_WALL_GROUND | COLLISION_WALL_SHARED;
}

export function wallBlocksBallLayer(wallLayer: WallLayer, ballLayer: BallLayer): boolean {
  if (wallLayer === "shared") return true;
  if (wallLayer === "ground") return ballLayer === "ground";
  return ballLayer === "deck";
}