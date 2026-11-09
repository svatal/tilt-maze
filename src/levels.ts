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
    name: "Obchvat doprava",
    start: { x: 68, y: 558 },
    goal: { x: 278, y: 108, r: 24 },
    traps: [],
    walls: [
      ...border(),
      { cx: 118, cy: 502, w: 196, h: 16 }
    ]
  },
  {
    id: 3,
    name: "Slepá ulička",
    start: { x: 66, y: 560 },
    goal: { x: 285, y: 102, r: 24 },
    traps: [],
    walls: [
      ...border(),
      { cx: 118, cy: 502, w: 196, h: 16 },
      { cx: 268, cy: 395, w: 16, h: 185 },
      { cx: 128, cy: 365, w: 116, h: 16 }
    ]
  },
  {
    id: 4,
    name: "Zigzag",
    start: { x: 62, y: 572 },
    goal: { x: 282, y: 105, r: 23 },
    traps: [],
    walls: [
      ...border(),
      { cx: 115, cy: 515, w: 190, h: 16 },
      { cx: 248, cy: 425, w: 190, h: 16 },
      { cx: 118, cy: 330, w: 196, h: 16 },
      { cx: 72, cy: 430, w: 16, h: 195 }
    ]
  },
  {
    id: 5,
    name: "Labyrint",
    start: { x: 58, y: 578 },
    goal: { x: 200, y: 105, r: 23 },
    traps: [],
    walls: [
      ...border(),
      { cx: 88, cy: 532, w: 116, h: 14 },
      { cx: 272, cy: 532, w: 116, h: 14 },
      { cx: 88, cy: 438, w: 116, h: 14 },
      { cx: 272, cy: 438, w: 116, h: 14 },
      { cx: 88, cy: 344, w: 116, h: 14 },
      { cx: 272, cy: 344, w: 116, h: 14 },
      { cx: 88, cy: 248, w: 108, h: 14 },
      { cx: 272, cy: 248, w: 108, h: 14 },
      { cx: 88, cy: 152, w: 98, h: 14 },
      { cx: 272, cy: 152, w: 98, h: 14 },
      { cx: 146, cy: 485, w: 14, h: 82 },
      { cx: 214, cy: 391, w: 14, h: 82 },
      { cx: 146, cy: 296, w: 14, h: 82 },
      { cx: 214, cy: 202, w: 14, h: 70 }
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
      { x: 175, y: 505, r: 14 },
      { x: 175, y: 405, r: 14 },
      { x: 175, y: 305, r: 14 },
      { x: 175, y: 205, r: 14 },
      { x: 218, y: 318, r: 13 }
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
      { x: 58, y: 515, r: 12 },
      { x: 58, y: 395, r: 12 },
      { x: 58, y: 275, r: 12 },
      { x: 120, y: 500, r: 16 },
      { x: 255, y: 500, r: 17 },
      { x: 180, y: 415, r: 16 },
      { x: 120, y: 330, r: 16 },
      { x: 255, y: 330, r: 16 },
      { x: 180, y: 245, r: 16 },
      { x: 120, y: 165, r: 15 },
      { x: 250, y: 165, r: 15 },
      { x: 302, y: 415, r: 12 }
    ],
    walls: border()
  }
];
