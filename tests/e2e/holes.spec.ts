import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

async function startLevel1(page: import("@playwright/test").Page) {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();
}

test("E2E: past na okraji misky — bez okamžitého propadu, tah ke středu", async ({ page }) => {
  await startLevel1(page);
  const placed = await page.evaluate(() => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number) => void;
      __e2eHoleState?: () => { trapSinking: boolean; goalSettling: boolean };
      __tiltMazeScene?: { ball?: { x: number; y: number } };
    };
    w.__e2ePlaceBall?.(201, 320);
    return {
      state: w.__e2eHoleState?.(),
      x: w.__tiltMazeScene?.ball?.x ?? 0,
      y: w.__tiltMazeScene?.ball?.y ?? 0
    };
  });
  expect(placed.state?.trapSinking).toBe(false);
  expect(placed.state?.goalSettling).toBe(false);

  await sleep(120);

  const phase = await page.evaluate(() => {
    const w = window as unknown as {
      __tiltMazeScene?: { ball?: { x: number; y: number } };
      __e2eHoleState?: () => { trapSinking: boolean };
    };
    const b = w.__tiltMazeScene?.ball;
    const x = b?.x ?? 0;
    const y = b?.y ?? 0;
    return {
      trapSinking: w.__e2eHoleState?.().trapSinking ?? false,
      dist: Math.hypot(x - 180, y - 320)
    };
  });

  expect(phase.trapSinking).toBe(false);
  expect(phase.dist).toBeLessThan(20.5);
  expect(phase.dist).toBeGreaterThan(7);
});

test("E2E: průlet jádrem pasti spustí propad", async ({ page }) => {
  await startLevel1(page);
  const trapped = await page.evaluate(() => {
    const w = window as unknown as {
      __e2eSimulateTrapFrame?: (x0: number, y0: number, x1: number, y1: number) => boolean;
    };
    return w.__e2eSimulateTrapFrame?.(150, 320, 210, 320) ?? false;
  });
  expect(trapped).toBe(true);
});

test("E2E: po pasti bez restartu reaguje na klávesnici", async ({ page }) => {
  await startLevel1(page);
  await page.evaluate(() => {
    const w = window as unknown as { __e2eSimulateTrapFrame?: (a: number, b: number, c: number, d: number) => boolean };
    w.__e2eSimulateTrapFrame?.(150, 320, 210, 320);
  });
  await sleep(400);

  const before = await page.evaluate(() => {
    const scene = (window as unknown as { __tiltMazeScene?: { ball?: { x: number } } }).__tiltMazeScene;
    const st = (window as unknown as { __e2eHoleState?: () => { ballStatic: boolean } }).__e2eHoleState?.();
    return { x: scene?.ball?.x ?? 0, static: st?.ballStatic ?? true };
  });
  expect(before.static).toBe(false);

  await page.keyboard.down("ArrowRight");
  await sleep(700);
  await page.keyboard.up("ArrowRight");

  const afterX = await page.evaluate(() => {
    const scene = (window as unknown as { __tiltMazeScene?: { ball?: { x: number } } }).__tiltMazeScene;
    return scene?.ball?.x ?? 0;
  });
  expect(afterX).toBeGreaterThan(before.x + 2);

  await page.evaluate(() => {
    const w = window as unknown as { __e2eSimulateTrapFrame?: (a: number, b: number, c: number, d: number) => boolean };
    w.__e2eSimulateTrapFrame?.(150, 320, 210, 320);
  });
  await sleep(400);
  await page.keyboard.down("ArrowUp");
  await sleep(500);
  await page.keyboard.up("ArrowUp");
  const movedAgain = await page.evaluate(() => {
    const scene = (window as unknown as { __tiltMazeScene?: { ball?: { y: number } } }).__tiltMazeScene;
    return (scene?.ball?.y ?? 999) < 580;
  });
  expect(movedAgain).toBe(true);
});

test("E2E: restart během propadu pasti obnoví hru", async ({ page }) => {
  await startLevel1(page);
  await page.evaluate(() => {
    const w = window as unknown as { __e2eSimulateTrapFrame?: (a: number, b: number, c: number, d: number) => boolean };
    w.__e2eSimulateTrapFrame?.(150, 320, 210, 320);
  });
  await sleep(80);
  await page.getByRole("button", { name: "Restart" }).click();
  await sleep(200);
  const st = await page.evaluate(() => {
    const w = window as unknown as { __e2eHoleState?: () => { trapSinking: boolean; ballStatic: boolean } };
    return w.__e2eHoleState?.();
  });
  expect(st?.trapSinking).toBe(false);
  expect(st?.ballStatic).toBe(false);
});

test("E2E: cíl na okraji misky — nejdřív táhne, výhra až u středu", async ({ page }) => {
  await startLevel1(page);
  await page.evaluate(() => {
    const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void };
    w.__e2ePlaceBall?.(300, 102);
  });
  await sleep(200);
  const earlyWin = await page.getByText("Výhra!", { exact: false }).isVisible();
  expect(earlyWin).toBe(false);

  await page.keyboard.down("ArrowUp");
  await sleep(1200);
  await page.keyboard.up("ArrowUp");

  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 6000 });
});
