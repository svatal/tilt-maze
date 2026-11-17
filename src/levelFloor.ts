import {
  colliderBlocksFromFloor,
  pitFeaturesFromHoles,
  type FloorBlockFeature,
  type FloorHeightFieldFeature,
  type FloorTerrainFeature
} from "./floorHeight";
import type { BlockRect, LevelDef } from "./levels";

export function levelFloorBlocks(lvl: LevelDef): FloorBlockFeature[] {
  return lvl.floor.filter((f): f is FloorBlockFeature => f.shape === "block");
}

export function levelTerrainFeatures(lvl: LevelDef): FloorTerrainFeature[] {
  return lvl.floor.filter((f): f is FloorTerrainFeature => f.shape !== "block");
}

export function levelPlayHeightFeatures(lvl: LevelDef): FloorHeightFieldFeature[] {
  return [...lvl.floor, ...pitFeaturesFromHoles(lvl.goal, lvl.traps)];
}

export function levelColliderBlocks(lvl: LevelDef): BlockRect[] {
  return colliderBlocksFromFloor(levelFloorBlocks(lvl));
}