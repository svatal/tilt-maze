/**
 * Definice úrovní v logickém prostoru 360×640 (portrét).
 * Podlaha = bloky (ostré schody) + terénní features; díry cíle/pastí doplní runtime profil propadu.
 */

import {
  BLOCK_PLATFORM_HEIGHT,
  bowlCircularAmplitude,
  bowlRectAmplitude,
  rampRiseForBand,
  type FloorBlockFeature,
  type FloorTerrainFeature
} from "./floorHeight";
import {
  FRAME_BOTTOM,
  FRAME_INNER_LEFT,
  FRAME_INNER_RIGHT,
  FRAME_TOP,
  PERIMETER_BLOCKS
} from "./levelGeometry";

export type BlockRect = { cx: number; cy: number; w: number; h: number };

export type FloorBlock = FloorBlockFeature;

export type FloorFeature = FloorBlock | FloorTerrainFeature;

export type LevelDef = {
  id: number;
  name: string;
  idea?: string;
  start: { x: number; y: number };
  goal: { x: number; y: number; r: number };
  traps: { x: number; y: number; r: number }[];
  floor: FloorFeature[];
};

const border = (): FloorBlock[] =>
  PERIMETER_BLOCKS.map((b) => ({ shape: "block", ...b, height: BLOCK_PLATFORM_HEIGHT }));

const INNER_TOP = 44;
const INNER_BOTTOM = 608;
const INNER_LEFT = 40;
const INNER_RIGHT = 320;
const GAP = 72;
const DOOR = 64;
const T = 14;
const XS = 180;

function vWallBottom(cx: number): FloorBlock {
  const h = INNER_BOTTOM - INNER_TOP - GAP;
  return { shape: "block", cx, cy: INNER_BOTTOM - h / 2, w: T, h, height: BLOCK_PLATFORM_HEIGHT };
}

function vWallTop(cx: number): FloorBlock {
  const baseH = INNER_BOTTOM - INNER_TOP - GAP;
  const h = baseH + (INNER_TOP - FRAME_TOP);
  return { shape: "block", cx, cy: FRAME_TOP + h / 2, w: T, h, height: BLOCK_PLATFORM_HEIGHT };
}

function slabH(cy: number, x0: number, x1: number): FloorBlock {
  const w = x1 - x0;
  return { shape: "block", cx: x0 + w / 2, cy, w, h: T, height: BLOCK_PLATFORM_HEIGHT };
}

function slabV(cx: number, y0: number, y1: number): FloorBlock {
  const h = y1 - y0;
  return { shape: "block", cx, cy: y0 + h / 2, w: T, h, height: BLOCK_PLATFORM_HEIGHT };
}

function rectRing(x0: number, y0: number, x1: number, y1: number, opening: "bl" | "tr"): FloorBlock[] {
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
      { shape: "block", cx: spanInnerX0 + topW / 2, cy: yt, w: topW, h: T, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: xr, cy: (y0 + y1) / 2, w: T, h: hSide, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: xl + GAP + botW / 2, cy: yb, w: botW, h: T, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: xl, cy: yt + leftH / 2, w: T, h: leftH, height: BLOCK_PLATFORM_HEIGHT }
    ];
  }
  const rightH = hSide - GAP;
  const topW = spanInnerX1 - (xl + GAP);
  const botW = spanInnerX1 - spanInnerX0;
  return [
    { shape: "block", cx: xl + GAP + topW / 2, cy: yt, w: topW, h: T, height: BLOCK_PLATFORM_HEIGHT },
    { shape: "block", cx: xr, cy: yt + GAP + rightH / 2, w: T, h: rightH, height: BLOCK_PLATFORM_HEIGHT },
    { shape: "block", cx: spanInnerX0 + botW / 2, cy: yb, w: botW, h: T, height: BLOCK_PLATFORM_HEIGHT },
    { shape: "block", cx: xl, cy: (y0 + y1) / 2, w: T, h: hSide, height: BLOCK_PLATFORM_HEIGHT }
  ];
}

const y1 = 220;
const y2 = 420;
const xl0 = INNER_LEFT;
const xl1 = XS - T / 2;
const xr0 = XS + T / 2;
const xr1 = INNER_RIGHT;
const doorY = (y1 + y2) / 2;

const L5_GRID: FloorBlock[] = [
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
    floor: border()
  },
  {
    id: 2,
    name: "Obchvat",
    start: { x: 68, y: 558 },
    goal: { x: 278, y: 108, r: 24 },
    traps: [],
    floor: [...border(), { shape: "block", cx: 228, cy: 395, w: 220, h: 16, height: BLOCK_PLATFORM_HEIGHT }]
  },
  {
    id: 3,
    name: "Serpentína",
    start: { x: 62, y: 578 },
    goal: { x: 298, y: 568, r: 15 },
    traps: [],
    floor: [...border(), vWallBottom(100), vWallTop(180), vWallBottom(260)]
  },
  {
    id: 4,
    name: "Spirála",
    start: { x: 46, y: 120 },
    goal: { x: 180, y: 320, r: 23 },
    traps: [],
    floor: [
      ...border(),
      ...rectRing(60, 90, 300, 550, "bl"),
      { shape: "block", cx: 223, cy: 356, w: T, h: 154, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 137, cy: 327, w: T, h: 212, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 153, cy: 433, w: 40, h: T, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 216, cy: 433, w: 58, h: T, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 180, cy: 442, w: T, h: 132, height: BLOCK_PLATFORM_HEIGHT }
    ]
  },
  {
    id: 5,
    name: "Komory",
    start: { x: 72, y: 580 },
    goal: { x: 288, y: 95, r: 16 },
    traps: [],
    floor: [...border(), ...L5_GRID]
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
    floor: [
      ...border(),
      { shape: "block", cx: 90, cy: 450, w: 140, h: 16, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 265, cy: 280, w: 150, h: 16, height: BLOCK_PLATFORM_HEIGHT }
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
    floor: [
      ...border(),
      { shape: "block", cx: 82, cy: 420, w: 108, h: 16, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 278, cy: 420, w: 108, h: 16, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 82, cy: 260, w: 108, h: 16, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 278, cy: 260, w: 108, h: 16, height: BLOCK_PLATFORM_HEIGHT }
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
    floor: [
      ...border(),
      { shape: "block", cx: 82, cy: 530, w: 100, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 278, cy: 530, w: 100, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 82, cy: 195, w: 100, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 278, cy: 195, w: 100, h: 14, height: BLOCK_PLATFORM_HEIGHT }
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
    floor: [
      ...border(),
      { shape: "block", cx: 46, cy: 362, w: 12, h: 492, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 314, cy: 362, w: 12, h: 492, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 92, cy: 528, w: 80, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 280, cy: 528, w: 56, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 110, cy: 408, w: 70, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 260, cy: 408, w: 50, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 104, cy: 218, w: 24, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 272, cy: 218, w: 42, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 68, cy: 258, w: 14, h: 68, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 68, cy: 462, w: 14, h: 117, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 292, cy: 258, w: 14, h: 68, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 292, cy: 462, w: 14, h: 117, height: BLOCK_PLATFORM_HEIGHT }
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
    floor: border()
  },
  {
    id: 11,
    name: "Jamka na cestě",
    idea:
      "Přejet širokou mělkou jamku na cestě — stačí mírný tilt nahoru; zeď nahoře nutí projet důlek, ne okolo.",
    start: { x: 62, y: 570 },
    goal: { x: 292, y: 108, r: 22 },
    traps: [],
    floor: [
      ...border(),
      { shape: "block", cx: 178, cy: 292, w: 196, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "bowl", cx: 178, cy: 390, r: 76, amplitude: -bowlCircularAmplitude(76) }
    ]
  },
  {
    id: 12,
    name: "Výstup po rampě",
    idea: "Vylézt po rampě na vyšší nástupnici, kde je cíl — start dole, cíl nahoře.",
    start: { x: 72, y: 575 },
    goal: { x: 285, y: 105, r: 20 },
    traps: [],
    floor: [
      ...border(),
      {
        shape: "ramp",
        axis: "horizontal",
        split: 338,
        band: 56,
        hLow: 0,
        hHigh: rampRiseForBand(56),
        lowSide: "bottom"
      }
    ]
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
    floor: [
      ...border(),
      {
        shape: "bowlRect",
        cx: 180,
        cy: 400,
        w: 252,
        h: 96,
        amplitude: bowlRectAmplitude(252, 96)
      }
    ]
  },
  {
    id: 14,
    name: "Koridor pastí",
    idea:
      "Jediná trasa k cíli vede širším koridorem mezi dvěma pastmi; boční obcházky zleva i zprava jsou zatarasené.",
    start: { x: 72, y: 568 },
    goal: { x: 288, y: 112, r: 22 },
    traps: [
      { x: 140, y: 398, r: 15 },
      { x: 220, y: 398, r: 15 }
    ],
    floor: [
      ...border(),
      {
        shape: "ramp",
        axis: "vertical",
        split: 158,
        band: 48,
        hLow: 0,
        hHigh: rampRiseForBand(48),
        lowSide: "left"
      },
      { shape: "block", cx: 111, cy: 398, w: 14, h: 352, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 249, cy: 398, w: 14, h: 352, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 68, cy: 324, w: 72, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 68, cy: 488, w: 72, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 292, cy: 324, w: 72, h: 14, height: BLOCK_PLATFORM_HEIGHT },
      { shape: "block", cx: 292, cy: 488, w: 72, h: 14, height: BLOCK_PLATFORM_HEIGHT }
    ]
  },
  {
    id: 15,
    name: "Nástupní plošina",
    idea:
      "Uprostřed desky plochá nástupnice (nížiny dole i nahoře); vystoupat z dolní nížiny a zastavit cíl na vrcholu — po stranách srazu sklon stahuje kuličku.",
    start: { x: 180, y: 578 },
    goal: { x: 180, y: 318, r: 22 },
    traps: [],
    floor: [...border(), { shape: "mesa", splitTop: 140, splitBottom: 512, band: 52 }]
  }
];
