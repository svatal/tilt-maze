import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dismissSensorBannerIfPresent } from "./helpers/playwrightTilt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

async function playLevelFromMenu(page: import("@playwright/test").Page, levelIndex: number) {
  await page.locator(`button[data-level-index="${levelIndex}"]`).click();
  await page.locator("#menu-btn-play").click();
  await page.waitForFunction(
    () => {
      const s = window as unknown as {
        __tiltMazeScene?: {
          running: boolean;
          ball?: { body?: unknown };
          verifyCanvasFitsViewport: () => boolean;
          verifyHudAboveBoard: () => boolean;
        };
      };
      const scene = s.__tiltMazeScene;
      return scene?.running === true && scene.ball?.body != null;
    },
    undefined,
    { timeout: 30000 }
  );
  await dismissSensorBannerIfPresent(page);
}

test("E2E: menu → úroveň → menu → úroveň (stejná i jiná)", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${basePath}?e2e=1`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });

  await playLevelFromMenu(page, 0);
  await expect(page.getByTestId("main-menu")).toBeHidden();
  await expect(page.locator("#tilt-maze-menu")).toBeHidden();
  await page.locator("#btn-menu").click();
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#tilt-maze-ui")).toHaveCount(0);

  await playLevelFromMenu(page, 3);
  await expect(page.getByTestId("main-menu")).toBeHidden();
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();

  expect(errors, errors.join("\n")).toEqual([]);
});
