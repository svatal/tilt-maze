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
    name: "První přehrada",
    start: { x: 68, y: 558 },
    goal: { x: 278, y: 108, r: 24 },
    traps: [],
    walls: [
      ...border(),
      { cx: 92, cy: 430, w: 145, h: 16 }
    ]
  },
  {
    id: 3,
    name: "Dvojitá brána",
    start: { x: 70, y: 560 },
    goal: { x: 285, y: 105, r: 24 },
    traps: [],
    walls: [
      ...border(),
      { cx: 95, cy: 455, w: 150, h: 16 },
      { cx: 255, cy: 310, w: 155, h: 16 }
    ]
  },
  {
    id: 4,
    name: "Smyčka",
    start: { x: 65, y: 555 },
    goal: { x: 282, y: 108, r: 23 },
    traps: [],
    walls: [
      ...border(),
      { cx: 88, cy: 480, w: 136, h: 16 },
      { cx: 268, cy: 400, w: 130, h: 16 },
      { cx: 95, cy: 280, w: 150, h: 16 }
    ]
  },
  {
    id: 5,
    name: "Bludiště",
    start: { x: 58, y: 578 },
    goal: { x: 200, y: 105, r: 23 },
    traps: [],
    walls: [
      ...border(),
      { cx: 82, cy: 530, w: 108, h: 16 },
      { cx: 278, cy: 530, w: 108, h: 16 },
      { cx: 82, cy: 430, w: 108, h: 16 },
      { cx: 278, cy: 430, w: 108, h: 16 },
      { cx: 82, cy: 330, w: 108, h: 16 },
      { cx: 278, cy: 330, w: 108, h: 16 },
      { cx: 82, cy: 230, w: 108, h: 14 },
      { cx: 278, cy: 230, w: 108, h: 14 },
      { cx: 82, cy: 135, w: 98, h: 14 },
      { cx: 278, cy: 135, w: 98, h: 14 }
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
      { x: 165, y: 510, r: 16 },
      { x: 255, y: 440, r: 15 },
      { x: 105, y: 370, r: 15 },
      { x: 220, y: 300, r: 15 },
      { x: 140, y: 220, r: 15 }
    ],
    walls: [
      ...border(),
      { cx: 80, cy: 455, w: 100, h: 14 },
      { cx: 280, cy: 455, w: 100, h: 14 },
      { cx: 80, cy: 355, w: 100, h: 14 },
      { cx: 280, cy: 355, w: 100, h: 14 },
      { cx: 80, cy: 255, w: 100, h: 14 },
      { cx: 280, cy: 255, w: 100, h: 14 },
      { cx: 80, cy: 155, w: 90, h: 14 },
      { cx: 280, cy: 155, w: 90, h: 14 }
    ]
  },
  {
    id: 10,
    name: "Slalom bez vodítek",
    start: { x: 78, y: 562 },
    goal: { x: 278, y: 112, r: 24 },
    traps: [
      { x: 105, y: 500, r: 17 },
      { x: 255, y: 500, r: 17 },
      { x: 180, y: 415, r: 16 },
      { x: 105, y: 330, r: 16 },
      { x: 255, y: 330, r: 16 },
      { x: 180, y: 245, r: 16 },
      { x: 115, y: 165, r: 15 },
      { x: 245, y: 165, r: 15 }
    ],
    walls: border()
  }
];
