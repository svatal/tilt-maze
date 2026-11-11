/**
 * Výškové pole podlahy h(x,y): součet primitiv (miska, rampa).
 * Stín = mapování výšky na odstín dřeva; tilt = směr −∇h (stejná jednotka jako deska).
 */

import { composeBoardAndHoleTilts, TILT_SIN_SCALE, type HoleDef } from "./holeSlope";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./constants";

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

/** Rampa: nízká strana 0, vysoká strana `rise`; horní část zóny = nástupnice. */
export type FloorRamp = {
  shape: "ramp";
  cx: number;
  cy: number;
  w: number;
  h: number;
  rise: number;
  lowSide: "top" | "bottom" | "left" | "right";
  /** Podíl výšky vyhrazený sklonu (zbytek = plochá vyšší nástupnice). */
  rampFrac?: number;
};

export type FloorHeightFeature = FloorBowlCircle | FloorBowlRect | FloorRamp;

const GRAD_EPS = 1.25;
/** Převod |∇h| na ekvivalent sklonu (~dřívější misky). */
const GRAD_TO_TILT = 48;

/** Změkčení hran obdélníkové rampy (podíl šířky/výšky). */
const RAMP_EDGE_FEATHER = 0.16;

function smooth01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function rampRectEnvelope(u: number, v: number, feather = RAMP_EDGE_FEATHER): number {
  const edgeU = smooth01(Math.min(u / feather, (1 - u) / feather));
  const edgeV = smooth01(Math.min(v / feather, (1 - v) / feather));
  return Math.min(edgeU, edgeV);
}

function rampClimbAlongAxis(u: number, v: number, f: FloorRamp): number {
  const frac = f.rampFrac ?? 0.42;
  switch (f.lowSide) {
    case "top":
      return v <= frac ? v / frac : 1;
    case "bottom":
      return v >= 1 - frac ? (1 - v) / frac : 1;
    case "left":
      return u <= frac ? u / frac : 1;
    default:
      return u >= 1 - frac ? (1 - u) / frac : 1;
  }
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
  const hw = f.w / 2;
  const hh = f.h / 2;
  const x0 = f.cx - hw;
  const y0 = f.cy - hh;
  const u = (x - x0) / f.w;
  const v = (y - y0) / f.h;
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
  const env = rampRectEnvelope(u, v);
  if (env <= 0) return 0;
  return f.rise * rampClimbAlongAxis(u, v, f) * env;
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
  return canvas;
}

/** Pro testy: je bod v ovlivněné oblasti kterékoli feature? */
export function ballOverFloorFeature(ballX: number, ballY: number, features: FloorHeightFeature[]): boolean {
  for (const f of features) {
    if (featureHeightAt(ballX, ballY, f) !== 0) return true;
    if (f.shape === "ramp") {
      const hw = f.w / 2;
      const hh = f.h / 2;
      if (Math.abs(ballX - f.cx) <= hw && Math.abs(ballY - f.cy) <= hh) return true;
    }
  }
  const eps = 0.5;
  return Math.abs(floorHeightAt(ballX, ballY, features)) > eps;
}
