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
  const rimDist = TRAP.r;
  const x = TRAP.cx + rimDist;
  await page.evaluate((px) => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number) => void;
      __e2eTickHoles?: () => void;
    };
    w.__e2ePlaceBall?.(px, 320);
    w.__e2eTickHoles?.();
  }, x);
  const st = await page.evaluate(() => {
    const w = window as unknown as { __e2eHoleState?: () => { trapSinking: boolean; lastTriggerDist: number | null } };
    return w.__e2eHoleState?.();
  });
  expect(st?.trapSinking).toBe(false);
  expect(st?.lastTriggerDist).toBeNull();
  await sleep(180);
  expect(await page.evaluate(() => (window as unknown as { __e2eHoleState?: () => { trapSinking: boolean } }).__e2eHoleState?.().trapSinking)).toBe(
    false
  );
});

test("E2E past: střed ve vnitřní polovině spustí propad a dist ≤ 0.5r", async ({ page }) => {
  await startLevel1(page);
  const innerR = TRAP.r * 0.5;
  await page.evaluate(() => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number) => void;
      __e2eTickHoles?: () => void;
    };
    w.__e2ePlaceBall?.(180 + 7, 320);
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
  expect(st?.lastTriggerDist).not.toBeNull();
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
    w.__e2ePlaceBall?.(187, 320);
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
    w.__e2ePlaceBall?.(187, 320);
    w.__e2eTickHoles?.();
  });
  await sleep(60);
  await page.getByRole("button", { name: "Restart" }).click();
  await sleep(150);
  const st = await page.evaluate(() => (window as unknown as { __e2eHoleState?: () => { trapSinking: boolean; ballStatic: boolean } }).__e2eHoleState?.());
  expect(st?.trapSinking).toBe(false);
  expect(st?.ballStatic).toBe(false);
});

test("E2E cíl: okraj bez výhry, trigger až ve vnitřní polovině", async ({ page }) => {
  await startLevel1(page);
  await page.evaluate(() => {
    const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void; __e2eTickHoles?: () => void };
    w.__e2ePlaceBall?.(300 + 26, 80);
    w.__e2eTickHoles?.();
  });
  expect(await page.getByText("Výhra!", { exact: false }).isVisible()).toBe(false);

  const innerR = GOAL.r * 0.5;
  await page.evaluate(() => {
    const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void; __e2eTickHoles?: () => void };
    w.__e2ePlaceBall?.(300 + 8, 80);
    w.__e2eTickHoles?.();
  });
  const st = await page.evaluate((maxR) => {
    const w = window as unknown as { __e2eHoleState?: () => { goalSettling: boolean; lastTriggerDist: number | null } };
    const s = w.__e2eHoleState?.();
    return s;
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
  await sleep(1200);
  await page.keyboard.up("ArrowUp");
  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 6000 });
});
