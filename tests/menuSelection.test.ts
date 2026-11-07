import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/levels";
import { HELP_SECTIONS } from "../src/ui/sensorHelpContent";

describe("úvodní menu — data", () => {
  it("všechny úrovně jsou k dispozici pro výběr", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(1);
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("nápověda obsahuje ovládání klávesnicí a senzory", () => {
    const text = HELP_SECTIONS.map((s) => s.title + s.bodyHtml).join(" ");
    expect(text).toMatch(/WASD|šipky/i);
    expect(text).toMatch(/Brave/i);
    expect(text).toMatch(/HTTPS/i);
    expect(text).toMatch(/Kalibr/i);
  });
});
