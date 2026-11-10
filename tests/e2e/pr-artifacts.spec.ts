import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");
const artifacts = "/opt/cursor/artifacts";
const LEVEL_COUNT = 15;
/** Nové sklonové úrovně + reprezentativní mobilní vzorky. */
const MOBILE_GEOMETRY_LEVELS = [11, 12, 14];
const SLOPE_LEVEL_INDICES = [10, 11, 12, 13, 14];

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
  await waitBoardReady(page);
}

async function shotAllLevelsFromMenu(
  page: import("@playwright/test").Page,
  view: string,
  w: number,
  h: number,
  levelFilter?: (index: number) => boolean
) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });
  if (view === "desktop") {
    await page.screenshot({ path: path.join(artifacts, "menu-desktop.png"), fullPage: false });
  } else {
    await page.screenshot({ path: path.join(artifacts, "menu-mobile.png"), fullPage: false });
  }

  for (let i = 0; i < LEVEL_COUNT; i++) {
    if (levelFilter && !levelFilter(i)) continue;
    await playLevelFromMenu(page, i);
    const name =
      view === "desktop"
        ? `board-1280x800-level-${i + 1}.png`
        : `board-390x844-level-${i + 1}.png`;
    await page.screenshot({ path: path.join(artifacts, name), fullPage: false });
    await page.locator("#btn-menu").click();
    await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
  }
}

test("PR artefakty: desktop — menu + sklonové úrovně 11–15", async ({ page }) => {
  test.setTimeout(120_000);
  await shotAllLevelsFromMenu(page, "desktop", 1280, 800, (i) => SLOPE_LEVEL_INDICES.includes(i));
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });
  await playLevelFromMenu(page, 0);
  await page.locator("#btn-menu").click();
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: path.join(artifacts, "menu-after-roundtrip-desktop.png"), fullPage: false });
});

test("PR artefakty: mobile — sklonové úrovně", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await shotAllLevelsFromMenu(page, "mobile", 390, 844, (i) => MOBILE_GEOMETRY_LEVELS.includes(i));
  } finally {
    await context.close();
  }
});
