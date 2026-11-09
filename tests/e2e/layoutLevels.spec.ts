import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

async function screenshotLevels(
  page: import("@playwright/test").Page,
  view: string,
  width: number,
  height: number
) {
  await page.setViewportSize({ width, height });
  await page.goto(`${basePath}?e2e=1&skipMenu=1&matterDebug=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => {
      const s = (window as unknown as {
        __tiltMazeScene?: { verifyHudAboveBoard: () => boolean; verifyCanvasFitsViewport: () => boolean };
      }).__tiltMazeScene;
      return s?.verifyHudAboveBoard() === true && s?.verifyCanvasFitsViewport() === true;
    },
    undefined,
    { timeout: 15000 }
  );

  const levelCount = 10;
  for (let i = 0; i < levelCount; i++) {
    await page.evaluate((n) => {
      const w = window as unknown as { __loadLevel?: (x: number) => void; __e2eRelayout?: () => void };
      w.__loadLevel?.(n);
      w.__e2eRelayout?.();
    }, i);
    await page.waitForFunction(
      () => {
        const s = (window as unknown as {
          __tiltMazeScene?: { verifyHudAboveBoard: () => boolean; verifyCanvasFitsViewport: () => boolean };
        }).__tiltMazeScene;
        return s?.verifyHudAboveBoard() === true && s?.verifyCanvasFitsViewport() === true;
      },
      undefined,
      { timeout: 15000 }
    );

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
