/**
 * Definice úrovní v logickém prostoru 360×640 (portrét).
 * Obdélníky zdí: střed + šířka/výška.
 */

export type WallDef = { cx: number; cy: number; w: number; h: number };

export type LevelDef = {
  id: number;
  name: string;
  start: { x: number; y: number };
  goal: { x: number; y: number; r: number };
  traps: { x: number; y: number; r: number }[];
  walls: WallDef[];
};

export const DESIGN_WIDTH = 360;
export const DESIGN_HEIGHT = 640;

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "Začátečník",
    start: { x: 60, y: 580 },
    goal: { x: 300, y: 80, r: 26 },
    traps: [{ x: 180, y: 320, r: 22 }],
    walls: [
      { cx: 180, cy: 20, w: 340, h: 24 },
      { cx: 180, cy: 620, w: 340, h: 24 },
      { cx: 20, cy: 320, w: 24, h: 580 },
      { cx: 340, cy: 320, w: 24, h: 580 },
      { cx: 180, cy: 200, w: 200, h: 20 },
      { cx: 100, cy: 380, w: 160, h: 20 },
      { cx: 260, cy: 440, w: 180, h: 20 }
    ]
  },
  {
    id: 2,
    name: "Hádanka",
    start: { x: 50, y: 580 },
    goal: { x: 310, y: 100, r: 26 },
    traps: [
      { x: 200, y: 250, r: 20 },
      { x: 120, y: 420, r: 20 },
      { x: 270, y: 380, r: 20 }
    ],
    walls: [
      { cx: 180, cy: 20, w: 340, h: 24 },
      { cx: 180, cy: 620, w: 340, h: 24 },
      { cx: 20, cy: 320, w: 24, h: 580 },
      { cx: 340, cy: 320, w: 24, h: 580 },
      { cx: 180, cy: 140, w: 260, h: 18 },
      { cx: 180, cy: 300, w: 220, h: 18 },
      { cx: 90, cy: 400, w: 18, h: 200 },
      { cx: 270, cy: 480, w: 18, h: 240 },
      { cx: 200, cy: 520, w: 160, h: 18 }
    ]
  },
  {
    id: 3,
    name: "Mistr",
    start: { x: 180, y: 600 },
    goal: { x: 180, y: 70, r: 24 },
    traps: [
      { x: 80, y: 480, r: 18 },
      { x: 280, y: 480, r: 18 },
      { x: 180, y: 350, r: 18 },
      { x: 60, y: 200, r: 16 },
      { x: 300, y: 200, r: 16 }
    ],
    walls: [
      { cx: 180, cy: 15, w: 340, h: 24 },
      { cx: 180, cy: 625, w: 340, h: 24 },
      { cx: 18, cy: 320, w: 24, h: 590 },
      { cx: 342, cy: 320, w: 24, h: 590 },
      { cx: 180, cy: 520, w: 300, h: 16 },
      { cx: 100, cy: 430, w: 16, h: 160 },
      { cx: 260, cy: 430, w: 16, h: 160 },
      { cx: 180, cy: 280, w: 280, h: 16 },
      { cx: 60, cy: 200, w: 16, h: 200 },
      { cx: 300, cy: 200, w: 16, h: 200 },
      { cx: 120, cy: 150, w: 160, h: 14 },
      { cx: 240, cy: 340, w: 14, h: 120 }
    ]
  }
];
