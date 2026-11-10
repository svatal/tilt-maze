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

async function playLevelFromMenu(page: import("@playwright/test").Page, levelIndex: number) {
  await page.locator(`button[data-level-index="${levelIndex}"]`).click();
  await page.locator("#menu-btn-play").click();
  await expect(page.getByTestId("main-menu")).toBeHidden({ timeout: 15000 });
  await expect(page.locator("#tilt-maze-menu")).toBeHidden();
  await page.waitForFunction(
    () => {
      const s = (window as unknown as {
        __tiltMazeScene?: { running: boolean; ball?: { body?: unknown } };
      }).__tiltMazeScene;
      return s?.running === true && s.ball?.body != null;
    },
    undefined,
    { timeout: 20000 }
  );
  await page.evaluate(() => (window as unknown as { __e2eRelayout?: () => void }).__e2eRelayout?.());
  await waitBoardReady(page);
}

async function shotsForViewport(page: import("@playwright/test").Page, view: string, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: path.join(artifacts, `menu-${view}.png`), fullPage: false });

  await playLevelFromMenu(page, 3);
  await page.screenshot({ path: path.join(artifacts, `l4-${view}.png`), fullPage: false });

  await page.locator("#btn-menu").click();
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
  await playLevelFromMenu(page, 8);
  await page.screenshot({ path: path.join(artifacts, `l9-${view}.png`), fullPage: false });

  await page.locator("#btn-menu").click();
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
}

test("PR artefakty: desktop menu a L4/L9", async ({ page }) => {
  await shotsForViewport(page, "desktop", 1280, 800);
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });
  await playLevelFromMenu(page, 0);
  await page.locator("#btn-menu").click();
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: path.join(artifacts, "menu-after-roundtrip-desktop.png"), fullPage: false });
});

test("PR artefakty: mobile menu a L4/L9", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await shotsForViewport(page, "mobile", 390, 844);
  } finally {
    await context.close();
  }
});
