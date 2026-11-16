import { describe, expect, it } from "vitest";
import {
  ballCollisionMask,
  COLLISION_BALL,
  COLLISION_WALL_DECK,
  wallBlocksBallLayer,
  wallCollisionCategory
} from "../src/matterCollision";
import { ballLayerAt, deckEnterHeight, resolveBallLayer, pointInBridgeSpan } from "../src/ballLayer";
import { LEVELS } from "../src/levels";
import { isLevelSolvable } from "../src/levelSolvability";

describe("bridge mechanic", () => {
  const l16 = LEVELS.find((l) => l.id === 16)!;

  it("Matter masky oddělují patro a přízemí", () => {
    expect(wallCollisionCategory("deck")).toBe(COLLISION_WALL_DECK);
    expect(ballCollisionMask("ground")).not.toBe(ballCollisionMask("deck"));
    expect(wallBlocksBallLayer("deck", "ground")).toBe(false);
    expect(wallBlocksBallLayer("ground", "deck")).toBe(false);
    expect(ballCollisionMask("ground") & COLLISION_WALL_DECK).toBe(0);
    expect(ballCollisionMask("deck") & COLLISION_WALL_DECK).toBeGreaterThan(0);
  });

  it("level 16 má most a je BFS řešitelný", () => {
    expect(l16.bridge).toBeDefined();
    expect(l16.walls.some((w) => w.layer === "deck")).toBe(true);
    expect(isLevelSolvable(l16)).toBe(true);
  });

  it("tunel uvnitř patky mostu zůstane na přízemí", () => {
    const under = { x: 168, y: 300 };
    expect(ballLayerAt(under.x, under.y, l16)).toBe("ground");
    expect(pointInBridgeSpan(under.x, under.y, l16.bridge!.span)).toBe(true);
    expect(resolveBallLayer("ground", under.x, under.y, l16)).toBe("ground");
  });

  it("hystereze vrstvy na nástupnici", () => {
    const onDeck = { x: 260, y: 330 };
    expect(ballLayerAt(onDeck.x, onDeck.y, l16)).toBe("deck");
    expect(deckEnterHeight(l16)).toBeGreaterThan(0);
    expect(resolveBallLayer("deck", onDeck.x, onDeck.y, l16)).toBe("deck");
    expect(pointInBridgeSpan(180, 320, l16.bridge!.span)).toBe(true);
  });
});