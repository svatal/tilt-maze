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
    start: { x: 55, y: 580 },
    goal: { x: 300, y: 95, r: 24 },
    traps: [
      { x: 300, y: 240, r: 15 },
      { x: 70, y: 340, r: 15 },
      { x: 200, y: 450, r: 15 }
    ],
    walls: [
      { cx: 180, cy: 20, w: 340, h: 24 },
      { cx: 180, cy: 620, w: 340, h: 24 },
      { cx: 20, cy: 320, w: 24, h: 580 },
      { cx: 340, cy: 320, w: 24, h: 580 },
      // Mezera mezi levým a pravým segmentem >= 36 px (kulička 22 + rezerva)
      { cx: 82, cy: 530, w: 108, h: 16 },
      { cx: 278, cy: 530, w: 108, h: 16 },
      { cx: 82, cy: 420, w: 108, h: 16 },
      { cx: 278, cy: 420, w: 108, h: 16 },
      { cx: 82, cy: 320, w: 108, h: 16 },
      { cx: 278, cy: 320, w: 108, h: 16 },
      { cx: 82, cy: 215, w: 108, h: 14 },
      { cx: 278, cy: 215, w: 108, h: 14 },
      { cx: 82, cy: 125, w: 98, h: 14 },
      { cx: 278, cy: 125, w: 98, h: 14 }
    ]
  },
  {
    id: 3,
    name: "Mistr",
    start: { x: 180, y: 600 },
    goal: { x: 300, y: 88, r: 22 },
    traps: [
      { x: 95, y: 480, r: 15 },
      { x: 265, y: 480, r: 15 },
      { x: 175, y: 310, r: 15 }
    ],
    walls: [
      { cx: 180, cy: 15, w: 340, h: 24 },
      { cx: 180, cy: 625, w: 340, h: 24 },
      { cx: 18, cy: 320, w: 24, h: 590 },
      { cx: 342, cy: 320, w: 24, h: 590 },
      // Stejný princip jako úroveň 2: páry segmentů, uprostřed dost široká cesta
      { cx: 80, cy: 540, w: 104, h: 16 },
      { cx: 280, cy: 540, w: 104, h: 16 },
      { cx: 80, cy: 440, w: 104, h: 16 },
      { cx: 280, cy: 440, w: 104, h: 16 },
      { cx: 80, cy: 340, w: 104, h: 16 },
      { cx: 280, cy: 340, w: 104, h: 16 },
      { cx: 80, cy: 240, w: 104, h: 16 },
      { cx: 280, cy: 240, w: 104, h: 16 },
      { cx: 80, cy: 140, w: 98, h: 14 },
      { cx: 280, cy: 140, w: 98, h: 14 }
    ]
  }
];
