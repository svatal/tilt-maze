/**
 * Definice úrovní v logickém prostoru 360×640 (portrét).
 * Obdélníky zdí: střed + šířka/výška.
 */

import {
  bowlCircularAmplitude,
  bowlRectAmplitude,
  rampRiseForBand,
  type FloorHeightFeature
} from "./floorHeight";
import {
  FRAME_BOTTOM,
  FRAME_INNER_LEFT,
  FRAME_INNER_RIGHT,
  FRAME_TOP,
  PERIMETER_WALLS
} from "./levelGeometry";

export type WallDef = { cx: number; cy: number; w: number; h: number };

export type LevelDef = {
  id: number;
  name: string;
  /** Stručná herní idea — co hráč musí zvládnout (hlavně úrovně 11–15). */
  idea?: string;
  start: { x: number; y: number };
  goal: { x: number; y: number; r: number };
  traps: { x: number; y: number; r: number }[];
  /** Lokální sklon podlahy (bez propadu). */
  slopes: FloorHeightFeature[];
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
  const baseH = INNER_BOTTOM - INNER_TOP - GAP;
  const h = baseH + (INNER_TOP - FRAME_TOP);
  return { cx, cy: FRAME_TOP + h / 2, w: T, h };
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
  const hSide = y1 - y0 - T;
  const spanInnerX0 = xl + T / 2;
  const spanInnerX1 = xr - T / 2;

  if (opening === "bl") {
    const leftH = hSide - GAP;
    const botW = spanInnerX1 - (xl + GAP);
    const topW = spanInnerX1 - spanInnerX0;
    return [
      { cx: spanInnerX0 + topW / 2, cy: yt, w: topW, h: T },
      { cx: xr, cy: (y0 + y1) / 2, w: T, h: hSide },
      { cx: xl + GAP + botW / 2, cy: yb, w: botW, h: T },
      { cx: xl, cy: yt + leftH / 2, w: T, h: leftH }
    ];
  }
  const rightH = hSide - GAP;
  const topW = spanInnerX1 - (xl + GAP);
  const botW = spanInnerX1 - spanInnerX0;
  return [
    { cx: xl + GAP + topW / 2, cy: yt, w: topW, h: T },
    { cx: xr, cy: yt + GAP + rightH / 2, w: T, h: rightH },
    { cx: spanInnerX0 + botW / 2, cy: yb, w: botW, h: T },
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
  slabV(XS, y2 + T, FRAME_BOTTOM),
  slabH(y2, FRAME_INNER_LEFT, xl0 + 58),
  slabH(y2, xl0 + 58 + DOOR, xl1),
  slabH(y2, xr0, FRAME_INNER_RIGHT),
  slabH(y1, xr0, xr1 - 58 - DOOR),
  slabH(y1, xr1 - 58, FRAME_INNER_RIGHT),
  slabH(y1, FRAME_INNER_LEFT, xl1),
  slabV(xr1 - 52, y2 + T / 2, INNER_BOTTOM - 48),
  slabV(xl0 + 52, INNER_TOP + T, y1 - T / 2),
  slabH(335, xl0 + 25, xl1 - 5),
  slabV(xl0 + 30, 265, 335 - T / 2),
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
    slopes: [],
    walls: border()
  },
  {
    id: 2,
    name: "Obchvat",
    start: { x: 68, y: 558 },
    goal: { x: 278, y: 108, r: 24 },
    traps: [],
    slopes: [],
    walls: [...border(), { cx: 228, cy: 395, w: 220, h: 16 }]
  },
  {
    id: 3,
    name: "Serpentína",
    start: { x: 62, y: 578 },
    goal: { x: 298, y: 568, r: 15 },
    traps: [],
    slopes: [],
    walls: [...border(), vWallBottom(100), vWallTop(180), vWallBottom(260)]
  },
  {
    id: 4,
    name: "Spirála",
    start: { x: 46, y: 120 },
    goal: { x: 180, y: 320, r: 23 },
    traps: [],
    slopes: [],
    walls: [
      ...border(),
      ...rectRing(60, 90, 300, 550, "bl"),
      { cx: 223, cy: 356, w: T, h: 154 },
      { cx: 137, cy: 327, w: T, h: 212 },
      { cx: 153, cy: 433, w: 40, h: T },
      { cx: 216, cy: 433, w: 58, h: T },
      { cx: 180, cy: 442, w: T, h: 132 }
    ]
  },
  {
    id: 5,
    name: "Komory",
    start: { x: 72, y: 580 },
    goal: { x: 288, y: 95, r: 16 },
    traps: [],
    slopes: [],
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
    slopes: [],
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
    slopes: [],
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
    slopes: [],
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
      { x: 248, y: 378, r: 12 },
      { x: 220, y: 302, r: 12 },
      { x: 248, y: 248, r: 12 },
      { x: 210, y: 182, r: 12 },
      { x: 236, y: 122, r: 11 },
      { x: 248, y: 492, r: 11 },
      { x: 235, y: 348, r: 11 },
      { x: 225, y: 268, r: 11 }
    ],
    slopes: [],
    walls: [
      ...border(),
      { cx: 46, cy: 362, w: 12, h: 492 },
      { cx: 314, cy: 362, w: 12, h: 492 },
      { cx: 92, cy: 528, w: 80, h: 14 },
      { cx: 280, cy: 528, w: 56, h: 14 },
      { cx: 110, cy: 408, w: 70, h: 14 },
      { cx: 260, cy: 408, w: 50, h: 14 },
      { cx: 104, cy: 218, w: 24, h: 14 },
      { cx: 272, cy: 218, w: 42, h: 14 },
      { cx: 68, cy: 258, w: 14, h: 68 },
      { cx: 68, cy: 462, w: 14, h: 117 },
      { cx: 292, cy: 258, w: 14, h: 68 },
      { cx: 292, cy: 462, w: 14, h: 117 }
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
    slopes: [],
    walls: border()
  },
  {
    id: 11,
    name: "Jamka na cestě",
    idea:
      "Přejet širokou mělkou jamku na cestě — stačí mírný tilt nahoru; zeď nahoře nutí projet důlek, ne okolo.",
    start: { x: 62, y: 570 },
    goal: { x: 292, y: 108, r: 22 },
    traps: [],
    slopes: [{ shape: "bowl", cx: 178, cy: 390, r: 76, amplitude: -bowlCircularAmplitude(76) }],
    walls: [...border(), { cx: 178, cy: 292, w: 196, h: 14 }]
  },
  {
    id: 12,
    name: "Výstup po rampě",
    idea: "Vylézt po rampě na vyšší nástupnici, kde je cíl — start dole, cíl nahoře.",
    start: { x: 72, y: 575 },
    goal: { x: 285, y: 105, r: 20 },
    traps: [],
    slopes: [
      {
        shape: "ramp",
        axis: "horizontal",
        split: 338,
        band: 56,
        hLow: 0,
        hHigh: rampRiseForBand(56),
        lowSide: "bottom"
      }
    ],
    walls: [...border()]
  },
  {
    id: 13,
    name: "Přes kopec",
    idea:
      "Přejet široký kopec po šířce desky; pasti po jeho bocích nutí jet přes vrchol místo okolo.",
    start: { x: 68, y: 560 },
    goal: { x: 278, y: 108, r: 23 },
    traps: [
      { x: 58, y: 418, r: 14 },
      { x: 302, y: 418, r: 14 }
    ],
    slopes: [
      {
        shape: "bowlRect",
        cx: 180,
        cy: 400,
        w: 252,
        h: 96,
        amplitude: bowlRectAmplitude(252, 96)
      }
    ],
    walls: [...border()]
  },
  {
    id: 14,
    name: "Koridor pastí",
    idea:
      "Projít úzkým koridorem mezi dvěma pastmi; mírná rampa vede zleva doprava k cíli.",
    start: { x: 72, y: 568 },
    goal: { x: 288, y: 112, r: 22 },
    traps: [
      { x: 142, y: 398, r: 15 },
      { x: 218, y: 398, r: 15 }
    ],
    slopes: [
      {
        shape: "ramp",
        axis: "vertical",
        split: 158,
        band: 48,
        hLow: 0,
        hHigh: rampRiseForBand(48),
        lowSide: "left"
      }
    ],
    walls: [
      ...border(),
      { cx: 118, cy: 380, w: 14, h: 168 },
      { cx: 242, cy: 380, w: 14, h: 168 }
    ]
  },
  {
    id: 15,
    name: "Finále sklonů",
    idea:
      "Finále: výstup spodní rampou, přejet středový kopec a dojet k cíli mezi třemi pastmi.",
    start: { x: 62, y: 578 },
    goal: { x: 272, y: 102, r: 21 },
    traps: [
      { x: 178, y: 520, r: 14 },
      { x: 118, y: 268, r: 13 },
      { x: 248, y: 268, r: 13 }
    ],
    slopes: [
      {
        shape: "ramp",
        axis: "horizontal",
        split: 418,
        band: 52,
        hLow: 0,
        hHigh: rampRiseForBand(52),
        lowSide: "bottom"
      },
      {
        shape: "bowlRect",
        cx: 180,
        cy: 350,
        w: 120,
        h: 72,
        amplitude: bowlRectAmplitude(120, 72)
      }
    ],
    walls: [...border(), { cx: 178, cy: 448, w: 140, h: 14 }]
  }
];
