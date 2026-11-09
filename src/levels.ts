/**
 * Definice úrovní v logickém prostoru 360×640 (portrét).
 * Obdélníky zdí: střed + šířka/výška.
 */

import { DESIGN_WIDTH } from "./constants";
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

const pad = 12;
const BAR_W = 218;
const SERP_W = 200;
const shelfL = (cy: number, w = BAR_W) => ({ cx: pad + w / 2 + 10, cy, w, h: 14 });
const shelfR = (cy: number, w = BAR_W) => ({ cx: DESIGN_WIDTH - pad - w / 2, cy, w, h: 14 });
const serpL = (cy: number) => ({ cx: pad + SERP_W / 2 + 10, cy, w: SERP_W, h: 14 });
const serpR = (cy: number) => ({ cx: DESIGN_WIDTH - pad - SERP_W / 2, cy, w: SERP_W, h: 14 });

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
    start: { x: 295, y: 562 },
    goal: { x: 68, y: 108, r: 23 },
    traps: [],
    walls: [
      ...border(),
      { cx: 88, cy: 520, w: 22, h: 118 },
      { cx: 272, cy: 470, w: 22, h: 118 },
      { cx: 88, cy: 370, w: 22, h: 118 },
      { cx: 272, cy: 320, w: 22, h: 118 },
      { cx: 88, cy: 220, w: 22, h: 105 },
      { cx: 272, cy: 170, w: 22, h: 105 },
      serpR(518),
      serpL(425),
      serpR(332),
      serpL(239),
      serpR(146),
      { cx: 292, cy: 482, w: 16, h: 90 },
      { cx: 68, cy: 388, w: 16, h: 90 },
      { cx: 292, cy: 296, w: 16, h: 90 },
      { cx: 68, cy: 202, w: 16, h: 72 }
    ]
  },
  {
    id: 4,
    name: "Spirála",
    start: { x: 62, y: 572 },
    goal: { x: 288, y: 102, r: 23 },
    traps: [],
    walls: [
      ...border(),
      shelfR(525),
      shelfL(435),
      shelfR(345),
      shelfL(255),
      shelfR(165, 205),
      shelfL(82, 168),
      { cx: 292, cy: 388, w: 16, h: 85 },
      { cx: 68, cy: 478, w: 16, h: 85 },
      { cx: 68, cy: 298, w: 16, h: 85 },
      { cx: 292, cy: 208, w: 16, h: 70 },
      { cx: 230, cy: 450, w: 14, h: 70 },
      { cx: 200, cy: 415, w: 65, h: 14 }
    ]
  },
  {
    id: 5,
    name: "Komory",
    start: { x: 58, y: 578 },
    goal: { x: 288, y: 102, r: 23 },
    traps: [],
    walls: [
      ...border(),
      shelfR(530),
      shelfL(445),
      shelfR(360),
      shelfL(275),
      shelfR(190, 205),
      shelfL(105, 170),
      { cx: 180, cy: 360, w: 18, h: 76 },
      { cx: 70, cy: 487, w: 16, h: 78 },
      { cx: 292, cy: 402, w: 16, h: 78 },
      { cx: 70, cy: 317, w: 16, h: 78 },
      { cx: 292, cy: 232, w: 16, h: 70 }
    ]
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
      { x: 128, y: 502, r: 12 },
      { x: 248, y: 502, r: 12 },
      { x: 180, y: 442, r: 12 },
      { x: 128, y: 378, r: 12 },
      { x: 248, y: 378, r: 12 },
      { x: 148, y: 302, r: 12 },
      { x: 128, y: 248, r: 12 },
      { x: 248, y: 248, r: 12 },
      { x: 180, y: 182, r: 12 },
      { x: 152, y: 122, r: 11 },
      { x: 208, y: 122, r: 11 },
      { x: 198, y: 468, r: 11 },
      { x: 145, y: 348, r: 11 },
      { x: 215, y: 268, r: 11 }
    ],
    walls: [
      ...border(),
      { cx: 180, cy: 528, w: 235, h: 14 },
      { cx: 68, cy: 468, w: 14, h: 98 },
      { cx: 292, cy: 468, w: 14, h: 98 },
      { cx: 180, cy: 408, w: 205, h: 14 },
      { cx: 292, cy: 345, w: 14, h: 105 },
      { cx: 68, cy: 282, w: 14, h: 105 },
      { cx: 180, cy: 218, w: 205, h: 14 },
      { cx: 138, cy: 165, w: 14, h: 62 },
      { cx: 222, cy: 165, w: 14, h: 62 },
      { cx: 180, cy: 368, w: 14, h: 55 },
      { cx: 180, cy: 285, w: 14, h: 55 }
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
