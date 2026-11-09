import { describe, expect, it } from "vitest";
import { menuLevelGroups } from "../src/menuLevelGroups";
import { LEVELS } from "../src/levels";
import { HELP_SECTIONS } from "../src/ui/sensorHelpContent";

describe("úvodní menu — data", () => {
  it("všechny úrovně jsou k dispozici pro výběr", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(1);
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("menu skupiny 5+5 podle pastí v LEVELS", () => {
    const groups = menuLevelGroups(LEVELS);
    expect(groups).toHaveLength(2);
    expect(groups[0].indices).toHaveLength(5);
    expect(groups[1].indices).toHaveLength(5);
    expect(groups[0].indices.every((i) => LEVELS[i].traps.length === 0)).toBe(true);
    expect(groups[1].indices.every((i) => LEVELS[i].traps.length > 0)).toBe(true);
    expect([...groups[0].indices, ...groups[1].indices].sort((a, b) => a - b)).toEqual(
      Array.from({ length: LEVELS.length }, (_, i) => i)
    );
  });

  it("nápověda obsahuje myš, senzory a bez ovládání kuličky šipkami", () => {
    const text = HELP_SECTIONS.map((s) => s.title + s.bodyHtml).join(" ");
    expect(text).toMatch(/Myš/i);
    expect(text).toMatch(/hnědočern/i);
    expect(text).not.toMatch(/červeným pastem|červených past/i);
    expect(text).not.toMatch(/WASD/i);
    expect(text).not.toMatch(/šipky nebo/i);
    expect(text).toMatch(/Brave/i);
    expect(text).toMatch(/HTTPS/i);
    expect(text).toMatch(/Kalibr/i);
  });
});
