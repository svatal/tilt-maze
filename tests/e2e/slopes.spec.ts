import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS } from "../../src/levels";
import { startGameFromMenu } from "./helpers/playwrightTilt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const SLOPE_LEVEL_INDEX = LEVELS.findIndex((l) => l.slopes.length > 0);
if (SLOPE_LEVEL_INDEX < 0) throw new Error("LEVELS musí obsahovat úroveň se sklonem");
const slopeLvl = LEVELS[SLOPE_LEVEL_INDEX];
const basin = slopeLvl.slopes[0];

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

test("E2E sklon: menu → úroveň 11 → okraj jamky přitahuje (bez propadu)", async ({ page }) => {
  await startGameFromMenu(page, SLOPE_LEVEL_INDEX);

  const rimPoint =
    basin.shape === "bowl" && "r" in basin
      ? { px: basin.cx + basin.r - 0.2, py: basin.cy }
      : { px: basin.cx, py: basin.cy };

  const rim = await page.evaluate(({ px, py }) => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number) => void;
      __e2eFloorSlopeMag?: (idx?: number) => number;
      __e2eHoleState?: () => { trapSinking: boolean; goalSettling: boolean };
    };
    w.__e2ePlaceBall?.(px, py);
    return {
      mag: w.__e2eFloorSlopeMag?.(0) ?? 0,
      trapSinking: w.__e2eHoleState?.().trapSinking ?? true,
      goalSettling: w.__e2eHoleState?.().goalSettling ?? true
    };
  }, rimPoint);

  expect(rim.trapSinking).toBe(false);
  expect(rim.goalSettling).toBe(false);
  expect(rim.mag).toBeGreaterThan(0.12);

  const depthOk = await page.evaluate(() => {
    const w = window as unknown as { __e2eRenderDepthOk?: () => boolean };
    return w.__e2eRenderDepthOk?.() ?? false;
  });
  expect(depthOk).toBe(true);
});

test("E2E sklon: mimo region nulová síla", async ({ page }) => {
  await startGameFromMenu(page, SLOPE_LEVEL_INDEX);
  const mag = await page.evaluate(() => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number) => void;
      __e2eFloorSlopeMag?: () => number;
    };
    w.__e2ePlaceBall?.(40, 40);
    return w.__e2eFloorSlopeMag?.() ?? -1;
  });
  expect(mag).toBe(0);
});
