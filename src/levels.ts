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

/** Vodorovný segment jen vlevo/vpravo — střídání šachty po výšce (široké = překryv uprostřed). */
const BOARD_PAD = 2;
const barL = (cy: number, w = 218) => ({ cx: BOARD_PAD + w / 2 + 10, cy, w, h: 14 });
const barR = (cy: number, w = 218) => ({ cx: DESIGN_WIDTH - BOARD_PAD - w / 2, cy, w, h: 14 });

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
    name: "Slepá ulička",
    start: { x: 66, y: 560 },
    goal: { x: 288, y: 102, r: 24 },
    traps: [],
    walls: [
      ...border(),
      barR(525),
      barL(435),
      barR(345),
      barL(255),
      barR(165, 205),
      { cx: 70, cy: 468, w: 16, h: 88 },
      { cx: 292, cy: 388, w: 16, h: 88 }
    ]
  },
  {
    id: 4,
    name: "Zigzag",
    start: { x: 62, y: 572 },
    goal: { x: 288, y: 102, r: 23 },
    traps: [],
    walls: [
      ...border(),
      barR(525),
      barL(435),
      barR(345),
      barL(255),
      barR(165, 205),
      barL(82, 168),
      { cx: 292, cy: 388, w: 16, h: 85 },
      { cx: 68, cy: 478, w: 16, h: 85 },
      { cx: 68, cy: 298, w: 16, h: 85 },
      { cx: 292, cy: 208, w: 16, h: 70 }
    ]
  },
  {
    id: 5,
    name: "Labyrint",
    start: { x: 58, y: 578 },
    goal: { x: 288, y: 102, r: 23 },
    traps: [],
    walls: [
      ...border(),
      barR(530),
      barL(445),
      barR(360),
      barL(275),
      barR(190, 205),
      barL(105, 170),
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
    start: { x: 55, y: 575 },
    goal: { x: 280, y: 108, r: 22 },
    traps: [
      { x: 109, y: 432, r: 12 },
      { x: 251, y: 432, r: 12 },
      { x: 109, y: 332, r: 12 },
      { x: 251, y: 332, r: 12 },
      { x: 109, y: 232, r: 12 },
      { x: 251, y: 232, r: 12 }
    ],
    walls: [
      ...border(),
      { cx: 92, cy: 455, w: 120, h: 14 },
      { cx: 268, cy: 455, w: 120, h: 14 },
      { cx: 39, cy: 455, w: 14, h: 86 },
      { cx: 321, cy: 455, w: 14, h: 86 },
      { cx: 92, cy: 355, w: 120, h: 14 },
      { cx: 268, cy: 355, w: 120, h: 14 },
      { cx: 39, cy: 355, w: 14, h: 86 },
      { cx: 321, cy: 355, w: 14, h: 86 },
      { cx: 92, cy: 255, w: 120, h: 14 },
      { cx: 268, cy: 255, w: 120, h: 14 },
      { cx: 39, cy: 255, w: 14, h: 86 },
      { cx: 321, cy: 255, w: 14, h: 86 },
      { cx: 92, cy: 155, w: 110, h: 14 },
      { cx: 268, cy: 155, w: 110, h: 14 },
      { cx: 39, cy: 155, w: 14, h: 70 },
      { cx: 321, cy: 155, w: 14, h: 70 }
    ]
  },
  {
    id: 10,
    name: "Slalom bez vodítek",
    start: { x: 118, y: 562 },
    goal: { x: 278, y: 112, r: 24 },
    traps: [
      ...[492, 464, 436, 408, 380, 352, 324, 296, 268, 240, 212, 184, 156].map((y) => ({ x: 51, y, r: 15 })),
      ...[492, 464, 436, 408, 380, 352, 324, 296, 268, 240, 212, 184, 156].map((y) => ({ x: 309, y, r: 15 })),
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
