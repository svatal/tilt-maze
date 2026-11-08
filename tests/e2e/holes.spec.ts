import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");

const TRAP = { cx: 180, cy: 320, r: 22 };
const GOAL = { cx: 300, cy: 80, r: 26 };
const TRIGGER_FRAC = 0.25;

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

async function startLevel1(page: import("@playwright/test").Page) {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();
}

test("E2E past: okraj viditelné díry (dist≈r) nespustí animaci", async ({ page }) => {
  await startLevel1(page);
  await page.evaluate((px) => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number) => void;
      __e2eTickHoles?: () => void;
    };
    w.__e2ePlaceBall?.(px, 320);
    w.__e2eTickHoles?.();
  }, TRAP.cx + TRAP.r);
  const st = await page.evaluate(() => {
    const w = window as unknown as { __e2eHoleState?: () => { trapSinking: boolean; lastTriggerDist: number | null } };
    return w.__e2eHoleState?.();
  });
  expect(st?.trapSinking).toBe(false);
  expect(st?.lastTriggerDist).toBeNull();
});

test("E2E past: na 0.5r už není trigger (jen mezikruh)", async ({ page }) => {
  await startLevel1(page);
  await page.evaluate(() => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number) => void;
      __e2eTickHoles?: () => void;
    };
    w.__e2ePlaceBall?.(180 + 11, 320);
    w.__e2eTickHoles?.();
  });
  const st = await page.evaluate(() => {
    const w = window as unknown as { __e2eHoleState?: () => { trapSinking: boolean } };
    return w.__e2eHoleState?.();
  });
  expect(st?.trapSinking).toBe(false);
});

test("E2E past: na okraji silný lokální tah (≈45°) bez animace", async ({ page }) => {
  await startLevel1(page);
  const rim = await page.evaluate(() => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number) => void;
      __e2eHoleLocalMag?: () => number;
      __e2eHoleState?: () => { trapSinking: boolean };
    };
    w.__e2ePlaceBall?.(180 + 22 - 0.15, 320);
    return {
      mag: w.__e2eHoleLocalMag?.() ?? 0,
      trapSinking: w.__e2eHoleState?.().trapSinking ?? true
    };
  });
  expect(rim.trapSinking).toBe(false);
  expect(rim.mag).toBeGreaterThan(1.45);
});

test("E2E past: střed v 0.25r spustí propad", async ({ page }) => {
  await startLevel1(page);
  const innerR = TRAP.r * TRIGGER_FRAC;
  await page.evaluate(() => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number) => void;
      __e2eTickHoles?: () => void;
    };
    w.__e2ePlaceBall?.(180 + 4, 320);
    w.__e2eTickHoles?.();
  });
  const st = await page.evaluate((maxR) => {
    const w = window as unknown as {
      __e2eHoleState?: () => { trapSinking: boolean; lastTriggerDist: number | null };
    };
    const s = w.__e2eHoleState?.();
    return { trapSinking: s?.trapSinking, lastTriggerDist: s?.lastTriggerDist };
  }, innerR);
  expect(st?.trapSinking).toBe(true);
  expect(st!.lastTriggerDist!).toBeLessThanOrEqual(innerR + 0.05);
});

test("E2E past: rychlý průlet mimo trigger — bez propadu", async ({ page }) => {
  await startLevel1(page);
  await page.evaluate(() => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number) => void;
      __e2eTickHoles?: () => void;
    };
    w.__e2ePlaceBall?.(130, 320);
    w.__e2eTickHoles?.();
    w.__e2ePlaceBall?.(230, 320);
    w.__e2eTickHoles?.();
  });
  const st = await page.evaluate(() => {
    const w = window as unknown as { __e2eHoleState?: () => { trapSinking: boolean; lastTriggerDist: number | null } };
    return w.__e2eHoleState?.();
  });
  expect(st?.trapSinking).toBe(false);
  expect(st?.lastTriggerDist).toBeNull();
});

test("E2E past: po propadu klávesnice bez restart", async ({ page }) => {
  await startLevel1(page);
  await page.evaluate(() => {
    const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void; __e2eTickHoles?: () => void };
    w.__e2ePlaceBall?.(183, 320);
    w.__e2eTickHoles?.();
  });
  await sleep(400);
  const before = await page.evaluate(() => {
    const scene = (window as unknown as { __tiltMazeScene?: { ball?: { x: number } } }).__tiltMazeScene;
    const st = (window as unknown as { __e2eHoleState?: () => { ballStatic: boolean } }).__e2eHoleState?.();
    return { x: scene?.ball?.x ?? 0, static: st?.ballStatic ?? true };
  });
  expect(before.static).toBe(false);
  await page.keyboard.down("ArrowRight");
  await sleep(600);
  await page.keyboard.up("ArrowRight");
  const afterX = await page.evaluate(() => (window as unknown as { __tiltMazeScene?: { ball?: { x: number } } }).__tiltMazeScene?.ball?.x ?? 0);
  expect(afterX).toBeGreaterThan(before.x + 2);
});

test("E2E: restart během propadu pasti", async ({ page }) => {
  await startLevel1(page);
  await page.evaluate(() => {
    const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void; __e2eTickHoles?: () => void };
    w.__e2ePlaceBall?.(183, 320);
    w.__e2eTickHoles?.();
  });
  await sleep(60);
  await page.getByRole("button", { name: "Restart" }).click();
  await sleep(150);
  const st = await page.evaluate(() => (window as unknown as { __e2eHoleState?: () => { trapSinking: boolean; ballStatic: boolean } }).__e2eHoleState?.());
  expect(st?.trapSinking).toBe(false);
  expect(st?.ballStatic).toBe(false);
});

test("E2E cíl: okraj bez výhry, trigger až v 0.25r", async ({ page }) => {
  await startLevel1(page);
  await page.evaluate(() => {
    const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void; __e2eTickHoles?: () => void };
    w.__e2ePlaceBall?.(300 + 26, 80);
    w.__e2eTickHoles?.();
  });
  expect(await page.getByText("Výhra!", { exact: false }).isVisible()).toBe(false);

  const innerR = GOAL.r * TRIGGER_FRAC;
  await page.evaluate(() => {
    const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void; __e2eTickHoles?: () => void };
    w.__e2ePlaceBall?.(300 + 5, 80);
    w.__e2eTickHoles?.();
  });
  const st = await page.evaluate((maxR) => {
    const w = window as unknown as { __e2eHoleState?: () => { goalSettling: boolean; lastTriggerDist: number | null } };
    return w.__e2eHoleState?.();
  }, innerR);
  expect(st?.goalSettling).toBe(true);
  expect(st?.lastTriggerDist).toBeLessThanOrEqual(innerR + 0.05);

  await sleep(520);
  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 4000 });
});

test("E2E cíl: mezikruh + klávesnice → výhra až u středu", async ({ page }) => {
  await startLevel1(page);
  await page.evaluate(() => {
    const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void };
    w.__e2ePlaceBall?.(300, 80 + 20);
  });
  await sleep(150);
  expect(await page.getByText("Výhra!", { exact: false }).isVisible()).toBe(false);
  await page.keyboard.down("ArrowUp");
  await sleep(1400);
  await page.keyboard.up("ArrowUp");
  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 8000 });
});
