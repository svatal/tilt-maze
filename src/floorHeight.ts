/**
 * Výškové pole podlahy h(x,y): součet primitiv (blok, miska, rampa, propad díry).
 * Stín = mapování výšky na odstín dřeva; tilt = směr −∇h (stejná jednotka jako deska).
 */

import { HOLE_TRIGGER_FRAC } from "./holeSlope";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./constants";
import {
  FRAME_BOTTOM,
  FRAME_INNER_LEFT,
  FRAME_INNER_RIGHT,
  FRAME_TOP
} from "./levelGeometry";

export type FloorBowlCircle = {
  shape: "bowl";
  cx: number;
  cy: number;
  r: number;
  /** Kladné = kopec u středu, záporné = jamka. Na okraji feature je 0. */
  amplitude: number;
};

export type FloorBowlRect = {
  shape: "bowlRect";
  cx: number;
  cy: number;
  w: number;
  h: number;
  amplitude: number;
};

export type FloorRamp = {
  shape: "ramp";
  axis: "horizontal" | "vertical";
  split: number;
  band: number;
  hLow: number;
  hHigh: number;
  lowSide: "top" | "bottom" | "left" | "right";
};

export type FloorMesa = {
  shape: "mesa";
  splitTop: number;
  splitBottom: number;
  band: number;
  rise?: number;
};

export type FloorTerrainFeature = FloorBowlCircle | FloorBowlRect | FloorRamp | FloorMesa;

/** Runtime propad cíle / pasti (není v LevelDef.floor). */
export type FloorPit = { shape: "pit"; cx: number; cy: number; r: number };

export type FloorBlockFeature = {
  shape: "block";
  cx: number;
  cy: number;
  w: number;
  h: number;
  height: number;
};

export type FloorHeightFieldFeature = FloorTerrainFeature | FloorBlockFeature | FloorPit;

export const BLOCK_PLATFORM_HEIGHT = 1.2;

/** Výška svislého kroku, který kulička nemůže vyjet po sklonu podlahy — vyšší blok ⇒ Matter kolider. */
export const MAX_CLIMBABLE_STEP_HEIGHT = 0.08;

const FEATURE_GRAD_EPS = 1.25;
const GRAD_TO_TILT = 48;
const TILT_SIN_SCALE = 2.2;

export const MAX_FLOOR_HEIGHT_GRAD = 0.011;

export const PIT_RIM_ANGLE_DEG = 45;
const RIM_RAD = (PIT_RIM_ANGLE_DEG * Math.PI) / 180;

export function bowlCircularAmplitude(r: number): number {
  return MAX_FLOOR_HEIGHT_GRAD * r;
}

export function bowlRectAmplitude(w: number, h: number): number {
  return MAX_FLOOR_HEIGHT_GRAD * Math.min(w / 2, h / 2);
}

export function rampRiseForBand(band: number): number {
  return MAX_FLOOR_HEIGHT_GRAD * band;
}

function pitK(visibleR: number): number {
  return RIM_RAD / visibleR;
}

/** h(rim)=0, ploché dno uvnitř trigger, k·d v annulu: h = (ln cos kr − ln cos kd)/(k·GRAD_TO_TILT). */
export function pitHeightAtDistance(d: number, visibleR: number): number {
  const inner = visibleR * HOLE_TRIGGER_FRAC;
  if (d > visibleR) return 0;
  const k = pitK(visibleR);
  const invKg = 1 / (k * GRAD_TO_TILT);
  const cosR = Math.cos(k * visibleR);

  const hAt = (dist: number) => {
    const cosD = Math.cos(k * dist);
    return (Math.log(cosR) - Math.log(cosD)) * invKg;
  };

  if (d <= inner) return hAt(inner);
  return hAt(d);
}

export function pitFeaturesFromHoles(
  goal: { x: number; y: number; r: number },
  traps: { x: number; y: number; r: number }[]
): FloorPit[] {
  const pits: FloorPit[] = [{ shape: "pit", cx: goal.x, cy: goal.y, r: goal.r }];
  for (const t of traps) pits.push({ shape: "pit", cx: t.x, cy: t.y, r: t.r });
  return pits;
}

export function colliderBlocksFromFloor(
  blocks: ReadonlyArray<Pick<FloorBlockFeature, "height" | "cx" | "cy" | "w" | "h">>
): Pick<FloorBlockFeature, "cx" | "cy" | "w" | "h">[] {
  return blocks
    .filter((b) => b.height > MAX_CLIMBABLE_STEP_HEIGHT)
    .map(({ cx, cy, w, h }) => ({ cx, cy, w, h }));
}

export function maxFloorHeightGradientMagnitude(features: FloorTerrainFeature[], step = 4): number {
  let maxG = 0;
  for (let y = FRAME_TOP; y < FRAME_BOTTOM; y += step) {
    for (let x = FRAME_INNER_LEFT; x < FRAME_INNER_RIGHT; x += step) {
      const g = floorHeightGradient(x, y, features);
      maxG = Math.max(maxG, Math.hypot(g.dx, g.dy));
    }
  }
  return maxG;
}

function rampBandHeight(coord: number, f: FloorRamp): number {
  const half = f.band / 2;
  const lo = f.split - half;
  const hi = f.split + half;

  if (f.axis === "horizontal") {
    const y = coord;
    if (f.lowSide === "top") {
      if (y <= lo) return f.hLow;
      if (y >= hi) return f.hHigh;
      const t = (y - lo) / f.band;
      return f.hLow + (f.hHigh - f.hLow) * t;
    }
    if (f.lowSide === "bottom") {
      if (y >= hi) return f.hLow;
      if (y <= lo) return f.hHigh;
      const t = (y - lo) / f.band;
      return f.hHigh + (f.hLow - f.hHigh) * t;
    }
    return 0;
  }

  const x = coord;
  if (f.lowSide === "left") {
    if (x <= lo) return f.hLow;
    if (x >= hi) return f.hHigh;
    const t = (x - lo) / f.band;
    return f.hLow + (f.hHigh - f.hLow) * t;
  }
  if (f.lowSide === "right") {
    if (x >= hi) return f.hLow;
    if (x <= lo) return f.hHigh;
    const t = (x - lo) / f.band;
    return f.hHigh + (f.hLow - f.hHigh) * t;
  }
  return 0;
}

function mesaHeightAt(y: number, f: FloorMesa): number {
  const rise = f.rise ?? rampRiseForBand(f.band);
  const fromTop: FloorRamp = {
    shape: "ramp",
    axis: "horizontal",
    split: f.splitTop,
    band: f.band,
    hLow: 0,
    hHigh: rise,
    lowSide: "top"
  };
  const fromBottom: FloorRamp = {
    shape: "ramp",
    axis: "horizontal",
    split: f.splitBottom,
    band: f.band,
    hLow: 0,
    hHigh: rise,
    lowSide: "bottom"
  };
  return Math.min(rampBandHeight(y, fromTop), rampBandHeight(y, fromBottom));
}

export function featureHeightAt(x: number, y: number, f: FloorHeightFieldFeature): number {
  if (f.shape === "block") {
    const hw = f.w / 2;
    const hh = f.h / 2;
    if (Math.abs(x - f.cx) <= hw && Math.abs(y - f.cy) <= hh) return f.height;
    return 0;
  }
  if (f.shape === "pit") {
    const d = Math.hypot(x - f.cx, y - f.cy);
    return pitHeightAtDistance(d, f.r);
  }
  if (f.shape === "bowl") {
    const d = Math.hypot(x - f.cx, y - f.cy);
    if (d >= f.r) return 0;
    return f.amplitude * (1 - d / f.r);
  }
  if (f.shape === "bowlRect") {
    const rx = f.w / 2;
    const ry = f.h / 2;
    const nx = (x - f.cx) / rx;
    const ny = (y - f.cy) / ry;
    const norm = Math.hypot(nx, ny);
    if (norm > 1) return 0;
    return f.amplitude * (1 - norm);
  }
  if (f.shape === "mesa") return mesaHeightAt(y, f);
  const coord = f.axis === "horizontal" ? y : x;
  return rampBandHeight(coord, f);
}

function pitFeatureGradient(x: number, y: number, f: FloorPit): { dx: number; dy: number } {
  const dx = x - f.cx;
  const dy = y - f.cy;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return { dx: 0, dy: 0 };
  const inner = f.r * HOLE_TRIGGER_FRAC;
  if (d > f.r || d <= inner) return { dx: 0, dy: 0 };
  const k = pitK(f.r);
  const gMag = Math.tan(k * d) / GRAD_TO_TILT;
  return { dx: (gMag * dx) / d, dy: (gMag * dy) / d };
}

function bowlFeatureGradient(x: number, y: number, f: FloorBowlCircle): { dx: number; dy: number } {
  const dx = x - f.cx;
  const dy = y - f.cy;
  const d = Math.hypot(dx, dy);
  if (d >= f.r || d < 1e-9) return { dx: 0, dy: 0 };
  const dhd = -f.amplitude / f.r;
  return { dx: (dhd * dx) / d, dy: (dhd * dy) / d };
}

function featureGradientNumeric(
  x: number,
  y: number,
  f: FloorHeightFieldFeature,
  eps = FEATURE_GRAD_EPS
): { dx: number; dy: number } {
  const hxp = featureHeightAt(x + eps, y, f);
  const hxm = featureHeightAt(x - eps, y, f);
  const hyp = featureHeightAt(x, y + eps, f);
  const hym = featureHeightAt(x, y - eps, f);
  return {
    dx: (hxp - hxm) / (2 * eps),
    dy: (hyp - hym) / (2 * eps)
  };
}

export function featureGradientAt(x: number, y: number, f: FloorHeightFieldFeature): { dx: number; dy: number } {
  if (f.shape === "block") return { dx: 0, dy: 0 };
  if (f.shape === "pit") return pitFeatureGradient(x, y, f);
  if (f.shape === "bowl") return bowlFeatureGradient(x, y, f);
  return featureGradientNumeric(x, y, f);
}

export function floorHeightAt(x: number, y: number, features: FloorHeightFieldFeature[]): number {
  let h = 0;
  for (const f of features) h += featureHeightAt(x, y, f);
  return h;
}

export function floorHeightGradient(
  x: number,
  y: number,
  features: FloorHeightFieldFeature[]
): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  for (const f of features) {
    const g = featureGradientAt(x, y, f);
    dx += g.dx;
    dy += g.dy;
  }
  return { dx, dy };
}

function gradientToTiltMagnitude(gx: number, gy: number): number {
  const g = Math.hypot(gx, gy);
  if (g <= 1e-9) return 0;
  const angleRad = Math.atan(g * GRAD_TO_TILT);
  return TILT_SIN_SCALE * Math.sin(angleRad);
}

export function floorHeightTilt(
  ballX: number,
  ballY: number,
  features: FloorHeightFieldFeature[]
): { ax: number; ay: number } {
  const g = floorHeightGradient(ballX, ballY, features);
  const mag = gradientToTiltMagnitude(g.dx, g.dy);
  if (mag <= 0) return { ax: 0, ay: 0 };
  const len = Math.hypot(g.dx, g.dy) || 1;
  return { ax: (-g.dx / len) * mag, ay: (-g.dy / len) * mag };
}

export function composeBoardAndFloorTilts(
  boardAx: number,
  boardAy: number,
  ballX: number,
  ballY: number,
  floorFeatures: FloorHeightFieldFeature[]
): { ax: number; ay: number } {
  const local = floorHeightTilt(ballX, ballY, floorFeatures);
  return { ax: boardAx + local.ax, ay: boardAy + local.ay };
}

export function floorHeightRange(features: FloorHeightFieldFeature[], step = 8): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (let y = step / 2; y < DESIGN_HEIGHT; y += step) {
    for (let x = step / 2; x < DESIGN_WIDTH; x += step) {
      const h = floorHeightAt(x, y, features);
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  if (max - min < 0.02) {
    min = -0.5;
    max = 0.5;
  }
  const pad = 0.08;
  return { min: min - pad, max: max + pad };
}

const WOOD_DARK = { r: 0x35, g: 0x22, b: 0x12 };
const WOOD_MID = { r: 0x5c, g: 0x3d, b: 0x21 };
const WOOD_LIGHT = { r: 0x8a, g: 0x68, b: 0x42 };

function heightToRgb(h: number, hMin: number, hMax: number): { r: number; g: number; b: number } {
  const span = hMax - hMin || 1;
  const t = Math.max(0, Math.min(1, (h - hMin) / span));
  const tone = 0.5 + (t - 0.5) * 1.55;
  const clamped = Math.max(0, Math.min(1, tone));
  if (clamped < 0.5) {
    const u = clamped / 0.5;
    return {
      r: Math.round(WOOD_DARK.r + (WOOD_MID.r - WOOD_DARK.r) * u),
      g: Math.round(WOOD_DARK.g + (WOOD_MID.g - WOOD_DARK.g) * u),
      b: Math.round(WOOD_DARK.b + (WOOD_MID.b - WOOD_DARK.b) * u)
    };
  }
  const u = (clamped - 0.5) / 0.5;
  return {
    r: Math.round(WOOD_MID.r + (WOOD_LIGHT.r - WOOD_MID.r) * u),
    g: Math.round(WOOD_MID.g + (WOOD_LIGHT.g - WOOD_MID.g) * u),
    b: Math.round(WOOD_MID.b + (WOOD_LIGHT.b - WOOD_MID.b) * u)
  };
}

function drawBlockEdges(ctx: CanvasRenderingContext2D, features: FloorHeightFieldFeature[]): void {
  const blocks = features.filter((f): f is FloorBlockFeature => f.shape === "block");
  if (!blocks.length) return;
  ctx.save();
  ctx.strokeStyle = "rgba(20, 10, 4, 0.45)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2;
  for (const b of blocks) {
    const x = b.cx - b.w / 2;
    const y = b.cy - b.h / 2;
    ctx.strokeRect(x + 0.5, y + 0.5, b.w - 1, b.h - 1);
  }
  ctx.restore();
}

export function bakeFloorHeightCanvas(features: FloorHeightFieldFeature[], pixelStep = 3): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = DESIGN_WIDTH;
  canvas.height = DESIGN_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const { min, max } = floorHeightRange(features, pixelStep);

  const img = ctx.createImageData(DESIGN_WIDTH, DESIGN_HEIGHT);
  for (let y = 0; y < DESIGN_HEIGHT; y++) {
    for (let x = 0; x < DESIGN_WIDTH; x++) {
      const sx = Math.round(x / pixelStep) * pixelStep + pixelStep / 2;
      const sy = Math.round(y / pixelStep) * pixelStep + pixelStep / 2;
      const h = floorHeightAt(sx, sy, features);
      const { r, g, b } = heightToRgb(h, min, max);
      const i = (y * DESIGN_WIDTH + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  drawBlockEdges(ctx, features);
  const innerW = FRAME_INNER_RIGHT - FRAME_INNER_LEFT;
  const innerH = FRAME_BOTTOM - FRAME_TOP;
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = "#fff";
  ctx.fillRect(FRAME_INNER_LEFT, FRAME_TOP, innerW, innerH);
  ctx.restore();
  return canvas;
}

export function ballOverFloorFeature(ballX: number, ballY: number, features: FloorHeightFieldFeature[]): boolean {
  for (const f of features) {
    if (f.shape === "ramp" || f.shape === "mesa" || f.shape === "block") return true;
    if (f.shape === "pit") {
      if (Math.hypot(ballX - f.cx, ballY - f.cy) <= f.r) return true;
      continue;
    }
    if (featureHeightAt(ballX, ballY, f) !== 0) return true;
  }
  const eps = 0.5;
  return Math.abs(floorHeightAt(ballX, ballY, features)) > eps;
}