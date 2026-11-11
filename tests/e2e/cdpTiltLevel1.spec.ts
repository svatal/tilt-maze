import { expect, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertMenuHiddenAfterPlay,
  clearCdpTilt,
  driveCdpTiltToLevel1Goal,
  startGameFromMenu
} from "./helpers/playwrightTilt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const artifacts = "/opt/cursor/artifacts";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function expectedBuildSha(): string {
  const gen = fs.readFileSync(path.join(root, "src/buildInfo.generated.ts"), "utf8");
  const label = /BUILD_INFO_LABEL = "([^"]+)"/.exec(gen)?.[1] ?? "";
  const fromLabel = label.split(" · ").find((p) => /^[0-9a-f]{7}$/i.test(p));
  return fromLabel ?? execSync("git rev-parse --short=7 HEAD", { cwd: root, encoding: "utf8" }).trim();
}

test.beforeAll(() => {
  execSync("npm run build", { cwd: root, stdio: "inherit" });
  fs.mkdirSync(artifacts, { recursive: true });
});

async function assertBuildLabel(page: Page): Promise<void> {
  await expect(page.locator("#tilt-maze-build-info")).toContainText(expectedBuildSha(), { timeout: 5000 });
}

async function finishLevel1(page: Page, shotPrefix: string): Promise<void> {
  await startGameFromMenu(page, 0, "", { beta: 12, gamma: 8 });
  await assertMenuHiddenAfterPlay(page);
  await assertBuildLabel(page);

  try {
    const tilt = driveCdpTiltToLevel1Goal(page, 75_000);
    const midroll = sleep(2500).then(() =>
      page.screenshot({ path: path.join(artifacts, `${shotPrefix}-midroll.png`) })
    );
    const win = expect(page.locator("#btn-next")).toBeVisible({ timeout: 80_000 });
    await Promise.all([tilt, midroll, win]);

    await expect(page.locator("#tilt-maze-sensor-warn")).toBeHidden();
    const sample = await page.evaluate(() => {
      const scene = (window as unknown as {
        __tiltMazeScene?: { tilt: { getSensorSnapshot: () => { orientValid: number } } };
      }).__tiltMazeScene;
      return scene?.tilt.getSensorSnapshot();
    });
    expect(sample?.orientValid ?? 0).toBeGreaterThan(0);

    await page.screenshot({ path: path.join(artifacts, `${shotPrefix}-complete.png`) });
  } finally {
    await clearCdpTilt(page);
  }
}

test("E2E: CDP tilt dokončí úroveň 1 z menu na mobilu", async ({ browser }) => {
  test.setTimeout(90_000);
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

test("E2E: bez orientačních dat ukáže banner senzorů (desktop)", async ({ browser }) => {
  test.setTimeout(30_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    await startGameFromMenu(page, 0);
    await expect(page.locator("#tilt-maze-sensor-warn")).toBeVisible({ timeout: 20_000 });
  } finally {
    await context.close();
  }
});

test("E2E: CDP tilt dokončí úroveň 1 z menu na desktopu", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  try {
    await finishLevel1(page, "cdp-tilt-desktop");
  } finally {
    await context.close();
  }
});
