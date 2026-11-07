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

test("E2E: rychlý náraz do zdi — měřitelný odraz; pomalý kontakt bez odrazu", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1&matterDebug=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();

  await page.evaluate(() => {
    const w = window as unknown as { __setBallPosition?: (x: number, y: number) => void };
    w.__setBallPosition?.(210, 520);
  });
  await sleep(200);

  await page.keyboard.down("ArrowLeft");
  await sleep(90);
  await page.keyboard.up("ArrowLeft");
  await sleep(400);

  const slowPeak = await page.evaluate(async () => {
    const w = window as unknown as {
      __getBallVelocity?: () => { x: number; y: number };
      __getBounceDebug?: () => { queued: number; applied: number; lastImpact: number; collisions: number };
    };
    let peak = 0;
    for (let i = 0; i < 8; i++) {
      const v = w.__getBallVelocity?.() ?? { x: 0, y: 0 };
      peak = Math.max(peak, Math.abs(v.x));
      await new Promise((r) => setTimeout(r, 30));
    }
    return { peak, dbg: w.__getBounceDebug?.() };
  });
  expect(slowPeak.peak).toBeLessThan(2.25);

  await page.evaluate(() => {
    const w = window as unknown as { __setBallPosition?: (x: number, y: number) => void };
    w.__setBallPosition?.(250, 520);
  });
  await sleep(200);

  await page.keyboard.down("ArrowLeft");
  const fastResult = await page.evaluate(async () => {
    const w = window as unknown as {
      __getBallVelocity?: () => { x: number; y: number };
      __getBallPosition?: () => { x: number; y: number };
      __getBounceDebug?: () => { queued: number; applied: number; lastImpact: number; collisions: number };
    };
    const samples: number[] = [];
    const id = setInterval(() => {
      const v = w.__getBallVelocity?.() ?? { x: 0, y: 0 };
      samples.push(v.x);
    }, 18);
    await new Promise((r) => setTimeout(r, 900));
    clearInterval(id);
    return {
      peakRebound: Math.max(...samples, 0),
      minApproach: Math.min(...samples, 0),
      pos: w.__getBallPosition?.() ?? { x: 0, y: 0 },
      dbg: w.__getBounceDebug?.() ?? { queued: 0, applied: 0, lastImpact: 0, collisions: 0 }
    };
  });
  await page.keyboard.up("ArrowLeft");

  expect(fastResult.dbg.obstacles, JSON.stringify(fastResult.dbg)).toBeGreaterThan(0);
  expect(fastResult.dbg.queued, JSON.stringify(fastResult.dbg)).toBeGreaterThan(0);
  expect(fastResult.minApproach).toBeLessThan(-1.5);
  expect(fastResult.peakRebound, JSON.stringify(fastResult)).toBeGreaterThan(0.35);
  expect(fastResult.peakRebound).toBeLessThan(Math.abs(fastResult.minApproach) * 0.95);
  expect(fastResult.pos.x).toBeLessThan(220);
});
