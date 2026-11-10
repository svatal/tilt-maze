import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");
const artifacts = "/opt/cursor/artifacts";

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
  fs.mkdirSync(artifacts, { recursive: true });
});

async function waitBoardReady(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const s = (window as unknown as {
        __tiltMazeScene?: { verifyHudAboveBoard: () => boolean; verifyCanvasFitsViewport: () => boolean };
      }).__tiltMazeScene;
      return s?.verifyHudAboveBoard() === true && s?.verifyCanvasFitsViewport() === true;
    },
    undefined,
    { timeout: 20000 }
  );
}

async function shotLevel(page: import("@playwright/test").Page, levelIndex: number, file: string) {
  await page.evaluate((n) => {
    const w = window as unknown as { __loadLevel?: (x: number) => void; __e2eRelayout?: () => void };
    w.__loadLevel?.(n);
    w.__e2eRelayout?.();
  }, levelIndex);
  await waitBoardReady(page);
  await page.screenshot({ path: path.join(artifacts, file), fullPage: false });
}

async function viewportShots(page: import("@playwright/test").Page, view: string, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${basePath}?e2e=1&skipMenu=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => !!(window as unknown as { __tiltMazeScene?: { running: boolean } }).__tiltMazeScene?.running,
    undefined,
    { timeout: 20000 }
  );
  await page.evaluate(() => (window as unknown as { __e2eRelayout?: () => void }).__e2eRelayout?.());
  await waitBoardReady(page);
  await shotLevel(page, 3, `l4-${view}.png`);
  await shotLevel(page, 8, `l9-${view}.png`);
}

test("PR artefakty: L4/L4 full board + menu roundtrip", async ({ page }) => {
  await viewportShots(page, "desktop", 1280, 800);
  await viewportShots(page, "mobile", 390, 844);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });
  await page.locator('button[data-level-index="0"]').click();
  await page.locator("#menu-btn-play").click();
  await page.waitForFunction(
    () => !!(window as unknown as { __tiltMazeScene?: { running: boolean } }).__tiltMazeScene?.running,
    undefined,
    { timeout: 20000 }
  );
  await page.locator("#btn-menu").click();
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: path.join(artifacts, "menu-after-roundtrip-desktop.png"), fullPage: false });
});
