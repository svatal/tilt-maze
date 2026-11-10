import { expect, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEVEL1_CDP_TILT_PHASES,
  assertMenuHiddenAfterPlay,
  cdpTiltStatus,
  startCdpDeviceOrientation,
  startGameFromMenu,
  stopCdpTiltForPage
} from "./helpers/playwrightTilt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const artifacts = "/opt/cursor/artifacts";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function expectedBuildSha(): string {
  const full = execSync("git rev-parse HEAD", { encoding: "utf8", cwd: root }).trim();
  return full.slice(0, 7);
}

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
  fs.mkdirSync(artifacts, { recursive: true });
});

async function assertBuildLabel(page: Page): Promise<void> {
  await expect(page.locator("#tilt-maze-build-info")).toContainText(expectedBuildSha(), { timeout: 5000 });
}

async function finishLevel1(page: Page, shotPrefix: string): Promise<void> {
  await startGameFromMenu(page, 0);
  await assertMenuHiddenAfterPlay(page);
  await assertBuildLabel(page);

  try {
    const [neutral, aimed] = LEVEL1_CDP_TILT_PHASES;
    await startCdpDeviceOrientation(page, neutral.beta, neutral.gamma);
    await sleep(neutral.ms);
    await startCdpDeviceOrientation(page, aimed.beta, aimed.gamma);

    const midDeadline = Date.now() + 15000;
    let shotMid = false;
    while (Date.now() < midDeadline && !shotMid) {
      const state = await page.evaluate(() => {
        const scene = (window as unknown as {
          __tiltMazeScene?: { ball?: { body?: { position?: { y: number } } } };
        }).__tiltMazeScene;
        const y = scene?.ball?.body?.position?.y;
        return { y: typeof y === "number" ? y : null, won: document.querySelector("#btn-next") != null };
      });
      if (state.y != null && state.y < 540 && state.y > 490 && !state.won) {
        await startCdpDeviceOrientation(page, 0, 0);
        await page.screenshot({ path: path.join(artifacts, `${shotPrefix}-midroll.png`) });
        await startCdpDeviceOrientation(page, aimed.beta, aimed.gamma);
        shotMid = true;
        break;
      }
      await sleep(15);
    }
    expect(shotMid).toBe(true);

    await page.waitForFunction(
      () => {
        const scene = (window as unknown as { __tiltMazeScene?: { goalSettling?: boolean } }).__tiltMazeScene;
        return scene?.goalSettling === true || document.querySelector("#btn-next") != null;
      },
      undefined,
      { timeout: 45000 }
    );
    await expect(page.locator("#btn-next")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#tilt-maze-sensor-warn")).toHaveCount(0);

    const sample = await page.evaluate(() => {
      const scene = (window as unknown as {
        __tiltMazeScene?: { tilt: { getSensorSnapshot: () => { orientValid: number; motionValid: number } } };
      }).__tiltMazeScene;
      return scene?.tilt.getSensorSnapshot();
    });
    expect(sample?.orientValid ?? 0).toBeGreaterThan(0);
    expect(sample?.motionValid ?? 0).toBeGreaterThan(0);

    const status = cdpTiltStatus(page);
    console.log(
      `${shotPrefix} orientation=${status.orientationCommand ?? "none"} accel=${status.sensorOverride} gravity=${status.gravityOverride} orientValid=${sample?.orientValid} motionValid=${sample?.motionValid}`
    );
    expect(status.sensorOverride).toBe("ok");

    await page.screenshot({ path: path.join(artifacts, `${shotPrefix}-complete.png`) });
  } finally {
    await stopCdpTiltForPage(page);
  }
}

test("E2E: CDP tilt dokončí úroveň 1 z menu na mobilu", async ({ browser }) => {
  test.setTimeout(70_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  try {
    await finishLevel1(page, "cdp-tilt-mobile");
  } finally {
    await context.close();
  }
});

test("E2E: CDP tilt dokončí úroveň 1 z menu na desktopu", async ({ page }) => {
  test.setTimeout(70_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await finishLevel1(page, "cdp-tilt-desktop");
});
