import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clearCdpTilt } from "./helpers/playwrightTilt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    execSync("npm run build", { cwd: root, stdio: "inherit" });
  }
});

/** Orientation override off — accelerometer CDP must feed devicemotion alone. */
test("E2E: CDP accelerometer override → devicemotion tilt", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await context.grantPermissions(["accelerometer", "gyroscope", "magnetometer"]);
  const page = await context.newPage();
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setSensorOverrideEnabled", { enabled: true, type: "accelerometer" });
    await page.goto(`${(process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/")}?e2e=1`, {
      waitUntil: "domcontentloaded"
    });
    await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });
    await page.locator('button[data-level-index="0"]').click();
    await page.locator("#menu-btn-play").click();
    await page.waitForFunction(
      () =>
        !!(window as unknown as { __tiltMazeScene?: { running: boolean } }).__tiltMazeScene?.running,
      undefined,
      { timeout: 20000 }
    );
    await clearCdpTilt(page);
    await sleep(700);

    const xyz = { x: 0.4, y: 5.8, z: 9.81 };
    for (let i = 0; i < 25; i++) {
      await cdp.send("Emulation.setSensorOverrideReadings", {
        type: "accelerometer",
        reading: { xyz }
      });
      await sleep(100);
    }

    const out = await page.evaluate(() => {
      const scene = (window as unknown as {
        __tiltMazeScene?: {
          tilt: {
            getSensorSnapshot: () => { motionValid: number; motionEvents: number };
            update: (d: number, s: number) => { ax: number; ay: number };
          };
        };
      }).__tiltMazeScene;
      let t = { ax: 0, ay: 0 };
      for (let i = 0; i < 20; i++) {
        t = scene?.tilt.update(16, 1) ?? t;
      }
      return { t, snap: scene?.tilt.getSensorSnapshot() };
    });
    expect(out.snap?.motionEvents ?? 0).toBeGreaterThan(0);
    expect(out.snap?.motionValid ?? 0).toBeGreaterThan(0);
    expect(Math.abs(out.t.ay)).toBeGreaterThan(0.03);

    await cdp
      .send("Emulation.setSensorOverrideEnabled", { enabled: false, type: "accelerometer" })
      .catch(() => undefined);
  } finally {
    await context.close();
  }
});
