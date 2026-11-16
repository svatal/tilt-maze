/**
 * Deck vs ground: transitions via floor height (ramp/mesa) with hysteresis in runtime.
 */

import { floorHeightAt, rampRiseForBand, type FloorHeightFeature } from "./floorHeight";
import type { LevelDef } from "./levels";
import type { BallLayer } from "./matterCollision";

const DECK_ENTER_FRAC = 0.86;
const DECK_EXIT_FRAC = 0.38;

export function plateauHeightFromFeatures(features: FloorHeightFeature[]): number {
  let top = 0;
  for (const f of features) {
    if (f.shape === "mesa") {
      top = Math.max(top, f.rise ?? rampRiseForBand(f.band));
    } else if (f.shape === "ramp") {
      top = Math.max(top, f.hHigh);
    }
  }
  return top;
}

export function deckEnterHeight(lvl: LevelDef): number {
  if (lvl.deckHeightMin != null) return lvl.deckHeightMin;
  const plateau = plateauHeightFromFeatures(lvl.slopes);
  return plateau * DECK_ENTER_FRAC;
}

export function deckExitHeight(lvl: LevelDef): number {
  const plateau = plateauHeightFromFeatures(lvl.slopes);
  return plateau * DECK_EXIT_FRAC;
}

function inBridgeUnderCorridor(
  x: number,
  y: number,
  lvl: LevelDef
): boolean {
  const span = lvl.bridge?.span;
  if (!span) return false;
  return x >= span.x0 && x <= span.x1 && y > span.y1 + 6;
}

/** Height-only layer estimate (BFS / spawn). */
export function ballLayerAt(
  x: number,
  y: number,
  lvl: LevelDef
): BallLayer {
  if (inBridgeUnderCorridor(x, y, lvl)) return "ground";
  const h = floorHeightAt(x, y, lvl.slopes);
  return h >= deckEnterHeight(lvl) ? "deck" : "ground";
}

export function resolveBallLayer(
  current: BallLayer,
  x: number,
  y: number,
  lvl: LevelDef
): BallLayer {
  if (inBridgeUnderCorridor(x, y, lvl)) return "ground";
  const h = floorHeightAt(x, y, lvl.slopes);
  const enter = deckEnterHeight(lvl);
  const exit = deckExitHeight(lvl);
  if (current === "ground" && h >= enter) return "deck";
  if (current === "deck" && h < exit) return "ground";
  return current;
}

export function levelUsesGradeSeparation(lvl: LevelDef): boolean {
  return Boolean(lvl.bridge) || lvl.walls.some((w) => w.layer === "deck");
}

export function pointInBridgeSpan(
  x: number,
  y: number,
  span: NonNullable<LevelDef["bridge"]>["span"]
): boolean {
  return x >= span.x0 && x <= span.x1 && y >= span.y0 && y <= span.y1;
}

/** Deck BFS may occupy bridge deck span when on patro. */
export function canOccupyDeckAt(x: number, y: number, lvl: LevelDef): boolean {
  const span = lvl.bridge?.span;
  const h = floorHeightAt(x, y, lvl.slopes);
  if (span && x >= span.x0 && x <= span.x1) {
    if (y > span.y1) return false;
    if (y >= span.y0 && y <= span.y1) return h >= deckExitHeight(lvl);
  }
  if (h >= deckEnterHeight(lvl)) return true;
  return false;
}

/** Ground BFS v koridoru pod mostem. */
export function canOccupyGroundUnderBridge(x: number, y: number, lvl: LevelDef): boolean {
  const span = lvl.bridge?.span;
  if (!span) return true;
  if (y < span.y0) return true;
  if (y > span.y1 + 6 && x >= span.x0 && x <= span.x1) return true;
  if (x < span.x0 - 4 || x > span.x1 + 4) return true;
  return floorHeightAt(x, y, lvl.slopes) < deckEnterHeight(lvl);
}