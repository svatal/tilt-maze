import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const artifacts = "/opt/cursor/artifacts";
const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");
const L16 = 15;

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

async function playLevelFromMenu(page: import("@playwright/test").Page, levelIndex: number) {
  await page.locator(`button[data-level-index="${levelIndex}"]`).click();
  await expect(page.locator("#tilt-maze-menu")).toBeHidden({ timeout: 15000 });
  await page.waitForFunction(
    () => {
      const s = (window as unknown as { __tiltMazeScene?: { running: boolean } }).__tiltMazeScene;
      return s?.running === true;
    },
    undefined,
    { timeout: 20000 }
  );
}

test("bridge PR artefakty: pod mostem a na patře", async ({ browser }) => {
  test.setTimeout(60_000);
  for (const [view, w, h] of [
    ["desktop", 1280, 800],
    ["mobile", 390, 844]
  ] as const) {
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await context.newPage();
    try {
      await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
      await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });
      await playLevelFromMenu(page, L16);
      await page.evaluate(() => {
        const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void };
        w.__e2ePlaceBall?.(178, 412);
      });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(artifacts, `bridge-under-${view}-${w}x${h}.png`),
        fullPage: false
      });
      await page.evaluate(() => {
        const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void };
        w.__e2ePlaceBall?.(220, 318);
      });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(artifacts, `bridge-deck-${view}-${w}x${h}.png`),
        fullPage: false
      });
    } finally {
      await context.close();
    }
  }
});