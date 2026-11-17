import { describe, expect, it } from "vitest";
import { HOLE_TRIGGER_FRAC } from "../src/holeSlope";
import {
  MAX_FLOOR_HEIGHT_GRAD,
  PIT_RIM_ANGLE_DEG,
  bowlCircularAmplitude,
  composeBoardAndFloorTilts,
  featureHeightAt,
  floorHeightAt,
  floorHeightGradient,
  floorHeightTilt,
  maxFloorHeightGradientMagnitude,
  pitFeaturesFromHoles,
  pitHeightAtDistance,
  rampRiseForBand,
  type FloorBowlCircle,
  type FloorPit,
  type FloorRamp
} from "../src/floorHeight";
import { levelPlayHeightFeatures, levelTerrainFeatures } from "../src/levelFloor";
import { LEVELS } from "../src/levels";

const TILT_SIN_SCALE = 2.2;
const GRAD_TO_TILT = 48;

/** Referenční annulus profil z PR před height-field (jen v testu). */
function legacyAnnulusTilt(
  ballX: number,
  ballY: number,
  hole: { cx: number; cy: number; r: number }
): { ax: number; ay: number } {
  const dx = hole.cx - ballX;
  const dy = hole.cy - ballY;
  const d = Math.hypot(dx, dy);
  const inner = hole.r * HOLE_TRIGGER_FRAC;
  if (d > hole.r || d <= inner) return { ax: 0, ay: 0 };
  const deg = PIT_RIM_ANGLE_DEG * (d / hole.r);
  const mag = TILT_SIN_SCALE * Math.sin((deg * Math.PI) / 180);
  const len = d > 1e-6 ? d : 1;
  return { ax: (dx / len) * mag, ay: (dy / len) * mag };
}

const basin: FloorBowlCircle = {
  shape: "bowl",
  cx: 180,
  cy: 320,
  r: 50,
  amplitude: -bowlCircularAmplitude(50)
};
const hill: FloorBowlCircle = {
  shape: "bowl",
  cx: 180,
  cy: 320,
  r: 50,
  amplitude: bowlCircularAmplitude(50)
};

const rampBand = 40;
const ramp: FloorRamp = {
  shape: "ramp",
  axis: "horizontal",
  split: 220,
  band: rampBand,
  hLow: 0,
  hHigh: rampRiseForBand(rampBand),
  lowSide: "top"
};

describe("floorHeight", () => {
  it("součet výšek z features", () => {
    expect(floorHeightAt(180, 320, [])).toBe(0);
    expect(featureHeightAt(180, 320, basin)).toBe(-bowlCircularAmplitude(50));
    expect(featureHeightAt(180, 320, hill)).toBe(bowlCircularAmplitude(50));
  });

  it("jamka: gradient směřuje ke středu (tilt dolů do jamky)", () => {
    const t = floorHeightTilt(228, 320, [basin]);
    expect(t.ax).toBeLessThan(0);
    expect(Math.hypot(t.ax, t.ay)).toBeGreaterThan(0.12);
  });

  it("kopec: opačný směr než jamka", () => {
    const b = floorHeightTilt(210, 330, [basin]);
    const h = floorHeightTilt(210, 330, [hill]);
    expect(Math.sign(b.ax)).toBe(-Math.sign(h.ax) || (b.ax === 0 && h.ax === 0));
  });

  it("stupňová rampa: dvě rovinné nástupnice přes celou šířku", () => {
    expect(featureHeightAt(20, 120, ramp)).toBe(0);
    expect(featureHeightAt(20, 400, ramp)).toBe(rampRiseForBand(rampBand));
  });

  it("stupňová rampa: gradient jen v pásmu sklonu", () => {
    const onSlope = floorHeightGradient(180, 225, [ramp]);
    expect(Math.abs(onSlope.dy)).toBeCloseTo(MAX_FLOOR_HEIGHT_GRAD, 3);
    expect(Math.abs(floorHeightGradient(180, 500, [ramp]).dy)).toBeLessThan(1e-6);
  });

  it("mesa: nížiny nahoře i dole, plochý střed", () => {
    const m = levelTerrainFeatures(LEVELS[14]).find((f) => f.shape === "mesa")!;
    expect(featureHeightAt(180, 50, m)).toBeLessThan(0.02);
    expect(featureHeightAt(180, 318, m)).toBeGreaterThan(0.4);
  });

  it("úrovně 11–15: |∇h| nikde nepřekročí MAX_FLOOR_HEIGHT_GRAD", () => {
    const eps = 1.0005;
    for (const lvl of LEVELS.filter((l) => l.id >= 11)) {
      const maxG = maxFloorHeightGradientMagnitude(levelTerrainFeatures(lvl));
      expect(maxG, `úroveň ${lvl.id}`).toBeLessThanOrEqual(MAX_FLOOR_HEIGHT_GRAD * eps);
    }
  });

  it("composeBoardAndFloorTilts přičítá tilt z pole", () => {
    const c = composeBoardAndFloorTilts(0.2, 0, 228, 320, [basin]);
    const local = floorHeightTilt(228, 320, [basin]);
    expect(c.ax).toBeCloseTo(0.2 + local.ax, 4);
  });
});

describe("pit height profile", () => {
  const r = 20;
  const k = (PIT_RIM_ANGLE_DEG * Math.PI) / 180 / r;

  it("uzavřený tvar sedí s dh/dd = tan(kd)/GRAD_TO_TILT", () => {
    const d = 12;
    const h = pitHeightAtDistance(d, r);
    const d2 = 12.01;
    const numerical = (pitHeightAtDistance(d2, r) - pitHeightAtDistance(d, r)) / (d2 - d);
    const analytic = Math.tan(k * d) / GRAD_TO_TILT;
    expect(numerical).toBeCloseTo(analytic, 3);
  });

  it("okraj a dno jsou ploché", () => {
    expect(pitHeightAtDistance(r + 1, r)).toBe(0);
    expect(pitHeightAtDistance(2, r)).toBeCloseTo(pitHeightAtDistance(4.9, r), 5);
  });
});

describe("pit tilt z ∇h (součet průspěvků)", () => {
  const goal = { x: 100, y: 100, r: 20 };
  const hole = { cx: goal.x, cy: goal.y, r: goal.r };
  const pit: FloorPit[] = pitFeaturesFromHoles(goal, []);
  const inner = hole.r * HOLE_TRIGGER_FRAC;
  const samples = [inner + 3, hole.r * 0.5, hole.r - 1, hole.r - 0.2];

  it.each(samples)("annulus d≈%s odpovídá legacy profilu", (d) => {
    const x = goal.x + d;
    const legacy = legacyAnnulusTilt(x, goal.y, hole);
    const fromField = floorHeightTilt(x, goal.y, pit);
    expect(fromField.ax).toBeCloseTo(legacy.ax, 2);
    expect(fromField.ay).toBeCloseTo(legacy.ay, 2);
  });

  it("trigger zóna: nulový gradient", () => {
    const x = goal.x + hole.r * HOLE_TRIGGER_FRAC * 0.5;
    expect(floorHeightTilt(x, goal.y, pit).ax).toBe(0);
  });

  it("rim: tilt přes gradientToTilt mapování", () => {
    const g = Math.tan((PIT_RIM_ANGLE_DEG * Math.PI) / 180) / GRAD_TO_TILT;
    const rimMag = TILT_SIN_SCALE * Math.sin(Math.atan(g * GRAD_TO_TILT));
    const x = goal.x + hole.r;
    const t = floorHeightTilt(x, goal.y, pit);
    expect(Math.hypot(t.ax, t.ay)).toBeCloseTo(rimMag, 2);
  });
});

describe("pit × terén překryv", () => {
  function pitInsideBowlRect(pit: FloorPit, f: { cx: number; cy: number; w: number; h: number }): boolean {
    const nx = Math.abs(pit.cx - f.cx) / (f.w / 2);
    const ny = Math.abs(pit.cy - f.cy) / (f.h / 2);
    return nx < 1 && ny < 1;
  }

  it("jen úroveň 13: boční pasti uvnitř eliptického kopce (součtové ∇h vs dřívější součet tiltů)", () => {
    const overlaps: number[] = [];
    for (const lvl of LEVELS) {
      for (const pit of pitFeaturesFromHoles(lvl.goal, lvl.traps)) {
        for (const f of levelTerrainFeatures(lvl)) {
          if (f.shape === "bowl" && Math.hypot(pit.cx - f.cx, pit.cy - f.cy) < f.r) overlaps.push(lvl.id);
          if (f.shape === "bowlRect" && pitInsideBowlRect(pit, f)) overlaps.push(lvl.id);
        }
      }
    }
    expect([...new Set(overlaps)]).toEqual([13]);
  });

  it("úroveň 13 past: gradient z součtu heightů, ne větší než samotná pit složka", () => {
    const lvl = LEVELS.find((l) => l.id === 13)!;
    const all = levelPlayHeightFeatures(lvl);
    const trap = lvl.traps[0];
    const pitOnly = pitFeaturesFromHoles({ x: 0, y: 0, r: 0 }, [trap]).slice(1);
    const x = trap.x + trap.r * 0.65;
    const y = trap.y;
    const gAll = floorHeightGradient(x, y, all);
    const gPit = floorHeightGradient(x, y, pitOnly);
    expect(Math.hypot(gAll.dx, gAll.dy)).toBeLessThanOrEqual(Math.hypot(gPit.dx, gPit.dy) * 1.2 + 0.02);
  });
});