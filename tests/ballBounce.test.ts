import { describe, expect, it } from "vitest";
import {
  approachSpeedTowardWall,
  BOUNCE_IMPACT_SPEED_MIN,
  BOUNCE_RESTITUTION_MAX,
  reflectVelocityAtWall,
  restitutionForImpactSpeed,
  velocityAfterWallBounce
} from "../src/ballBounce";

describe("ballBounce", () => {
  it("pomalý kontakt nemá odraz", () => {
    expect(restitutionForImpactSpeed(0.1)).toBe(0);
    expect(restitutionForImpactSpeed(BOUNCE_IMPACT_SPEED_MIN - 0.01)).toBe(0);
  });

  it("rychlý přímý náraz má skromný odraz bez zesílení energie", () => {
    const e = restitutionForImpactSpeed(5);
    expect(e).toBeGreaterThan(0.15);
    expect(e).toBeLessThanOrEqual(BOUNCE_RESTITUTION_MAX);
    const vIn = { x: 0, y: 5 };
    const n = { x: 0, y: -1 };
    const vOut = reflectVelocityAtWall(vIn, n, 5);
    expect(vOut.y).toBeLessThan(0);
    expect(vOut.y).toBeGreaterThan(-5);
    expect(vOut.x).toBe(0);
    const energyIn = vIn.x * vIn.x + vIn.y * vIn.y;
    const energyOut = vOut.x * vOut.x + vOut.y * vOut.y;
    expect(energyOut).toBeLessThan(energyIn);
  });

  it("šikmý náraz zachová tangenciální rychlost", () => {
    const vIn = { x: 3, y: 4 };
    const n = { x: 0, y: -1 };
    const impact = approachSpeedTowardWall(vIn, n);
    expect(impact).toBeCloseTo(4, 5);
    const vOut = reflectVelocityAtWall(vIn, n, impact);
    expect(vOut.x).toBeCloseTo(3, 5);
    expect(vOut.y).toBeLessThan(0);
  });

  it("velocityAfterWallBounce po solveru přidá jen normální odraz", () => {
    const pending = { normal: { x: 0, y: 1 }, impactSpeed: 4.5 };
    const afterSolver = { x: 0.2, y: 0 };
    const v = velocityAfterWallBounce(afterSolver, pending);
    expect(v.y).toBeGreaterThan(0.5);
    expect(v.x).toBeCloseTo(0.2, 5);
  });
});
