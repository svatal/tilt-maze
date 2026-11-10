/**
 * Definice úrovní v logickém prostoru 360×640 (portrét).
 * Obdélníky zdí: střed + šířka/výška.
 */

import { PERIMETER_WALLS } from "./levelGeometry";

export type WallDef = { cx: number; cy: number; w: number; h: number };

export type LevelDef = {
  id: number;
  name: string;
  start: { x: number; y: number };
  goal: { x: number; y: number; r: number };
  traps: { x: number; y: number; r: number }[];
  walls: WallDef[];
};

const border = () => [...PERIMETER_WALLS];

const INNER_TOP = 44;
const INNER_BOTTOM = 608;
const INNER_LEFT = 40;
const INNER_RIGHT = 320;
const GAP = 72;
const DOOR = 64;
const T = 14;
const XS = 180;

function vWallBottom(cx: number): WallDef {
  const h = INNER_BOTTOM - INNER_TOP - GAP;
  return { cx, cy: INNER_BOTTOM - h / 2, w: T, h };
}

function vWallTop(cx: number): WallDef {
  const h = INNER_BOTTOM - INNER_TOP - GAP;
  return { cx, cy: INNER_TOP + h / 2, w: T, h };
}

function slabH(cy: number, x0: number, x1: number): WallDef {
  const w = x1 - x0;
  return { cx: x0 + w / 2, cy, w, h: T };
}

function slabV(cx: number, y0: number, y1: number): WallDef {
  const h = y1 - y0;
  return { cx, cy: y0 + h / 2, w: T, h };
}

function rectRing(x0: number, y0: number, x1: number, y1: number, opening: "bl" | "tr"): WallDef[] {
  const xr = x1 - T / 2;
  const xl = x0 + T / 2;
  const yt = y0 + T / 2;
  const yb = y1 - T / 2;
  const wTop = x1 - x0 - T;
  const hSide = y1 - y0 - T;
  if (opening === "bl") {
    const leftH = hSide - GAP;
    const botW = wTop - GAP;
    return [
      { cx: (x0 + x1) / 2, cy: yt, w: wTop, h: T },
      { cx: xr, cy: (y0 + y1) / 2, w: T, h: hSide },
      { cx: xl + GAP + botW / 2, cy: yb, w: botW, h: T },
      { cx: xl, cy: yt + leftH / 2, w: T, h: leftH }
    ];
  }
  const rightH = hSide - GAP;
  const topW = wTop - GAP;
  return [
    { cx: xl + topW / 2, cy: yt, w: topW, h: T },
    { cx: xr, cy: yt + GAP + rightH / 2, w: T, h: rightH },
    { cx: (x0 + x1) / 2, cy: yb, w: wTop, h: T },
    { cx: xl, cy: (y0 + y1) / 2, w: T, h: hSide }
  ];
}

const y1 = 220;
const y2 = 420;
const xl0 = INNER_LEFT;
const xl1 = XS - T / 2;
const xr0 = XS + T / 2;
const xr1 = INNER_RIGHT;
const doorY = (y1 + y2) / 2;

const L5_GRID: WallDef[] = [
  slabV(XS, INNER_TOP + T, doorY - DOOR / 2),
  slabV(XS, doorY + DOOR / 2, y2 + T / 2),
  slabV(XS, y2 + T, INNER_BOTTOM - T),
  slabH(y2, xl0, xl0 + 58),
  slabH(y2, xl0 + 58 + DOOR, xl1),
  slabH(y2, xr0, xr1),
  slabH(y1, xr0, xr1 - 58 - DOOR),
  slabH(y1, xr1 - 58, xr1),
  slabH(y1, xl0, xl1),
  slabV(xr1 - 52, y2 + 28, INNER_BOTTOM - 48),
  slabV(xl0 + 52, INNER_TOP + T, y1 - T),
  slabH(335, xl0 + 25, xl1 - 5),
  slabV(xl0 + 30, 265, 325),
  slabV(xr0 + 25, 265, 325),
  slabV(xr0 + 58, 300, 360)
];

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "Otevřená deska",
    start: { x: 72, y: 565 },
    goal: { x: 248, y: 118, r: 26 },
    traps: [],
    walls: border()
  },
  {
    id: 2,
    name: "Obchvat",
    start: { x: 68, y: 558 },
    goal: { x: 278, y: 108, r: 24 },
    traps: [],
    walls: [...border(), { cx: 228, cy: 395, w: 220, h: 16 }]
  },
  {
    id: 3,
    name: "Serpentína",
    start: { x: 62, y: 578 },
    goal: { x: 298, y: 568, r: 15 },
    traps: [],
    walls: [...border(), vWallBottom(100), vWallTop(180), vWallBottom(260)]
  },
  {
    id: 4,
    name: "Spirála",
    start: { x: 46, y: 120 },
    goal: { x: 180, y: 320, r: 23 },
    traps: [],
    walls: [
      ...border(),
      ...rectRing(60, 90, 300, 550, "bl"),
      ...rectRing(130, 200, 230, 440, "tr"),
      { cx: 180, cy: 472, w: T, h: 172 }
    ]
  },
  {
    id: 5,
    name: "Komory",
    start: { x: 72, y: 580 },
    goal: { x: 288, y: 95, r: 16 },
    traps: [],
    walls: [...border(), ...L5_GRID]
  },
  {
    id: 6,
    name: "Opatrně kolem děr",
    start: { x: 70, y: 565 },
    goal: { x: 288, y: 102, r: 24 },
    traps: [
      { x: 180, y: 380, r: 16 },
      { x: 260, y: 520, r: 15 }
    ],
    walls: [
      ...border(),
      { cx: 90, cy: 450, w: 140, h: 16 },
      { cx: 265, cy: 280, w: 150, h: 16 }
    ]
  },
  {
    id: 7,
    name: "Zkouška rovnováhy",
    start: { x: 62, y: 572 },
    goal: { x: 278, y: 110, r: 23 },
    traps: [
      { x: 135, y: 480, r: 16 },
      { x: 225, y: 480, r: 16 },
      { x: 180, y: 340, r: 15 }
    ],
    walls: [
      ...border(),
      { cx: 82, cy: 420, w: 108, h: 16 },
      { cx: 278, cy: 420, w: 108, h: 16 },
      { cx: 82, cy: 260, w: 108, h: 16 },
      { cx: 278, cy: 260, w: 108, h: 16 }
    ]
  },
  {
    id: 8,
    name: "Past na úzké lince",
    start: { x: 180, y: 585 },
    goal: { x: 185, y: 100, r: 22 },
    traps: [
      { x: 85, y: 500, r: 15 },
      { x: 275, y: 500, r: 15 },
      { x: 85, y: 360, r: 15 },
      { x: 275, y: 360, r: 15 },
      { x: 180, y: 230, r: 15 }
    ],
    walls: [
      ...border(),
      { cx: 82, cy: 530, w: 100, h: 14 },
      { cx: 278, cy: 530, w: 100, h: 14 },
      { cx: 82, cy: 195, w: 100, h: 14 },
      { cx: 278, cy: 195, w: 100, h: 14 }
    ]
  },
  {
    id: 9,
    name: "Mistrovská kombinace",
    start: { x: 292, y: 562 },
    goal: { x: 88, y: 108, r: 22 },
    traps: [
      { x: 248, y: 502, r: 12 },
      { x: 248, y: 378, r: 12 },
      { x: 220, y: 302, r: 12 },
      { x: 248, y: 248, r: 12 },
      { x: 210, y: 182, r: 12 },
      { x: 236, y: 122, r: 11 },
      { x: 248, y: 492, r: 11 },
      { x: 235, y: 348, r: 11 },
      { x: 225, y: 268, r: 11 }
    ],
    walls: [
      ...border(),
      { cx: 46, cy: 360, w: 12, h: 488 },
      { cx: 314, cy: 360, w: 12, h: 488 },
      { cx: 105, cy: 528, w: 90, h: 14 },
      { cx: 268, cy: 528, w: 104, h: 14 },
      { cx: 120, cy: 408, w: 50, h: 14 },
      { cx: 258, cy: 408, w: 58, h: 14 },
      { cx: 112, cy: 218, w: 38, h: 14 },
      { cx: 258, cy: 218, w: 48, h: 14 },
      { cx: 292, cy: 335, w: 14, h: 85 },
      { cx: 68, cy: 272, w: 14, h: 85 },
      { cx: 130, cy: 165, w: 14, h: 48 },
      { cx: 230, cy: 165, w: 14, h: 48 },
      { cx: 180, cy: 383, w: 14, h: 34 },
      { cx: 180, cy: 275, w: 14, h: 34 }
    ]
  },
  {
    id: 10,
    name: "Slalom bez vodítek",
    start: { x: 118, y: 562 },
    goal: { x: 278, y: 112, r: 24 },
    traps: [
      { x: 51, y: 488, r: 15 },
      { x: 51, y: 438, r: 15 },
      { x: 51, y: 368, r: 15 },
      { x: 51, y: 298, r: 15 },
      { x: 51, y: 228, r: 15 },
      { x: 51, y: 178, r: 15 },
      { x: 309, y: 473, r: 15 },
      { x: 309, y: 403, r: 15 },
      { x: 309, y: 333, r: 15 },
      { x: 309, y: 263, r: 15 },
      { x: 309, y: 193, r: 15 },
      { x: 130, y: 500, r: 16 },
      { x: 248, y: 500, r: 16 },
      { x: 180, y: 410, r: 16 },
      { x: 130, y: 325, r: 16 },
      { x: 248, y: 325, r: 16 },
      { x: 180, y: 240, r: 16 },
      { x: 145, y: 165, r: 15 },
      { x: 215, y: 165, r: 15 }
    ],
    walls: border()
  }
];
