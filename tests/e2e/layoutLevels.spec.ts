import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startGameFromMenu } from "./helpers/playwrightTilt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
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

async function screenshotLevels(
  page: import("@playwright/test").Page,
  view: string,
  width: number,
  height: number
) {
  await page.setViewportSize({ width, height });
  await startGameFromMenu(page, 0);
  await waitBoardReady(page);

  const levelCount = 15;
  for (let i = 0; i < levelCount; i++) {
    if (i > 0) {
      await page.locator("#btn-menu").click();
      await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
      await playLevelFromMenu(page, i);
    }

    const ok = await page.evaluate(() => {
      const s = (window as unknown as {
        __tiltMazeScene?: {
          verifyWallsFitDesignBoard: () => boolean;
          verifyHudAboveBoard: () => boolean;
          verifyCanvasFitsViewport: () => boolean;
        };
      }).__tiltMazeScene;
      return {
        walls: s?.verifyWallsFitDesignBoard() ?? false,
        hud: s?.verifyHudAboveBoard() ?? false,
        viewport: s?.verifyCanvasFitsViewport() ?? false
      };
    });
    expect(ok.walls, `úroveň ${i + 1} má zeď mimo desku`).toBe(true);
    expect(ok.hud, `úroveň ${i + 1}: HUD překrývá desku`).toBe(true);
    expect(ok.viewport, `úroveň ${i + 1}: canvas oříznutý viewportem`).toBe(true);

    await fs.promises.mkdir("/opt/cursor/artifacts", { recursive: true });
    await page.screenshot({
      path: `/opt/cursor/artifacts/board-${view}-level-${i + 1}.png`,
      fullPage: false
    });
  }
}

test("deska: 1280×800 — všechny zdi uvnitř rámu", async ({ page }) => {
  await screenshotLevels(page, "1280x800", 1280, 800);
});

test("deska: 390×844 — všechny zdi uvnitř rámu", async ({ page }) => {
  await screenshotLevels(page, "390x844", 390, 844);
});
