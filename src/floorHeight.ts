/**
 * Výškové pole podlahy h(x,y): součet primitiv (miska, rampa).
 * Stín = mapování výšky na odstín dřeva; tilt = směr −∇h (stejná jednotka jako deska).
 */

import { composeBoardAndHoleTilts, TILT_SIN_SCALE, type HoleDef } from "./holeSlope";
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

/**
 * Stupňová rampa přes celou desku: dvě nástupnice + pás sklonu.
 * Mimo pásmo sklonu je výška konstantní (flat ⇒ žádný tilt).
 */
export type FloorRamp = {
  shape: "ramp";
  axis: "horizontal" | "vertical";
  /** Střed přechodového pásma (y pro horizontální, x pro vertikální). */
  split: number;
  /** Tloušťka pásma sklonu [px], lineární přechod hLow → hHigh. */
  band: number;
  hLow: number;
  hHigh: number;
  lowSide: "top" | "bottom" | "left" | "right";
};

export type FloorHeightFeature = FloorBowlCircle | FloorBowlRect | FloorRamp;

const GRAD_EPS = 1.25;
/** Převod |∇h| na ekvivalent sklonu (~dřívější misky). */
const GRAD_TO_TILT = 48;

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

export function featureHeightAt(x: number, y: number, f: FloorHeightFeature): number {
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
  const coord = f.axis === "horizontal" ? y : x;
  return rampBandHeight(coord, f);
}

export function floorHeightAt(x: number, y: number, features: FloorHeightFeature[]): number {
  let h = 0;
  for (const f of features) h += featureHeightAt(x, y, f);
  return h;
}

export function floorHeightGradient(
  x: number,
  y: number,
  features: FloorHeightFeature[],
  eps = GRAD_EPS
): { dx: number; dy: number } {
  const hxp = floorHeightAt(x + eps, y, features);
  const hxm = floorHeightAt(x - eps, y, features);
  const hyp = floorHeightAt(x, y + eps, features);
  const hym = floorHeightAt(x, y - eps, features);
  return {
    dx: (hxp - hxm) / (2 * eps),
    dy: (hyp - hym) / (2 * eps)
  };
}

function gradientToTiltMagnitude(gx: number, gy: number): number {
  const g = Math.hypot(gx, gy);
  if (g <= 1e-9) return 0;
  const angleRad = Math.atan(g * GRAD_TO_TILT);
  return TILT_SIN_SCALE * Math.sin(angleRad);
}

/** Lokální tilt z výškového pole (−∇h). */
export function floorHeightTilt(
  ballX: number,
  ballY: number,
  features: FloorHeightFeature[]
): { ax: number; ay: number } {
  const g = floorHeightGradient(ballX, ballY, features);
  const mag = gradientToTiltMagnitude(g.dx, g.dy);
  if (mag <= 0) return { ax: 0, ay: 0 };
  const len = Math.hypot(g.dx, g.dy);
  const ux = g.dx / len;
  const uy = g.dy / len;
  return { ax: -ux * mag, ay: -uy * mag };
}

export function composeBoardHoleAndFloorTilts(
  boardAx: number,
  boardAy: number,
  ballX: number,
  ballY: number,
  goal: HoleDef | null,
  trapHoles: HoleDef[],
  floorFeatures: FloorHeightFeature[]
): { ax: number; ay: number } {
  const base = composeBoardAndHoleTilts(boardAx, boardAy, ballX, ballY, goal, trapHoles);
  if (!floorFeatures.length) return base;
  const local = floorHeightTilt(ballX, ballY, floorFeatures);
  return { ax: base.ax + local.ax, ay: base.ay + local.ay };
}

/** Rozsah výšek pro normalizaci stínu (hrubý průchod mřížkou). */
export function floorHeightRange(
  features: FloorHeightFeature[],
  step = 8
): { min: number; max: number } {
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

/** Jednorázový bake stínování podlahy (volitelný hrubší krok pro mobil). */
export function bakeFloorHeightCanvas(
  features: FloorHeightFeature[],
  pixelStep = 3
): HTMLCanvasElement {
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
  const innerW = FRAME_INNER_RIGHT - FRAME_INNER_LEFT;
  const innerH = FRAME_BOTTOM - FRAME_TOP;
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = "#fff";
  ctx.fillRect(FRAME_INNER_LEFT, FRAME_TOP, innerW, innerH);
  ctx.restore();
  return canvas;
}

/** Pro testy: je bod v ovlivněné oblasti kterékoli feature? */
export function ballOverFloorFeature(ballX: number, ballY: number, features: FloorHeightFeature[]): boolean {
  for (const f of features) {
    if (f.shape === "ramp") return true;
    if (featureHeightAt(ballX, ballY, f) !== 0) return true;
  }
  const eps = 0.5;
  return Math.abs(floorHeightAt(ballX, ballY, features)) > eps;
}
