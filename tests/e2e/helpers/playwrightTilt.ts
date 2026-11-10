import { expect, type CDPSession, type Page } from "@playwright/test";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Game ignores orientation samples older than 550ms (`src/tiltMapping.ts`); one CDP override emits once. */
const ORIENTATION_REFRESH_MS = 200;

type Binding = {
  cdp: CDPSession;
  angles: { alpha: number; beta: number; gamma: number };
  refreshTimer?: ReturnType<typeof setInterval>;
};

const bindings = new WeakMap<Page, Binding>();

async function ensureBinding(page: Page): Promise<Binding> {
  let binding = bindings.get(page);
  if (!binding) {
    await page.context().grantPermissions(["accelerometer", "gyroscope", "magnetometer"]);
    const cdp = await page.context().newCDPSession(page);
    binding = { cdp, angles: { alpha: 0, beta: 0, gamma: 0 } };
    bindings.set(page, binding);
    page.on("close", () => clearCdpTilt(page).catch(() => undefined));
  }
  return binding;
}

// Playwright Chromium: only DeviceOrientation.* exists (`Emulation.setDeviceOrientationOverride` is missing).
async function sendOrientation(binding: Binding): Promise<void> {
  const { alpha, beta, gamma } = binding.angles;
  await binding.cdp.send("DeviceOrientation.setDeviceOrientationOverride", { alpha, beta, gamma });
}

function startRefresh(binding: Binding): void {
  if (binding.refreshTimer) return;
  binding.refreshTimer = setInterval(() => {
    void sendOrientation(binding).catch(() => undefined);
  }, ORIENTATION_REFRESH_MS);
}

/** Hold β/γ via CDP until `clearCdpTilt`. */
export async function setCdpTilt(
  page: Page,
  tilt: { beta: number; gamma: number; alpha?: number }
): Promise<void> {
  const binding = await ensureBinding(page);
  binding.angles = { alpha: tilt.alpha ?? 0, beta: tilt.beta, gamma: tilt.gamma };
  await sendOrientation(binding);
  startRefresh(binding);
}

export async function clearCdpTilt(page: Page): Promise<void> {
  const binding = bindings.get(page);
  if (!binding) return;
  if (binding.refreshTimer) {
    clearInterval(binding.refreshTimer);
    binding.refreshTimer = undefined;
  }
  await binding.cdp.send("DeviceOrientation.clearDeviceOrientationOverride").catch(() => undefined);
}

const LEVEL1_GOAL = { x: 248, y: 118 };

export async function driveCdpTiltToLevel1Goal(page: Page, timeoutMs = 50_000): Promise<void> {
  await setCdpTilt(page, { beta: 8, gamma: 6 });
  await sleep(900);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await page.locator("#btn-next").isVisible().catch(() => false)) return;
    const pos = await page.evaluate(() => {
      const b = (window as unknown as { __tiltMazeScene?: { ball?: { x: number; y: number } } }).__tiltMazeScene
        ?.ball;
      return { x: b?.x ?? 72, y: b?.y ?? 565 };
    });
    let beta = 0;
    let gamma = 0;
    if (pos.y > LEVEL1_GOAL.y + 18) beta = -38;
    else if (pos.y < LEVEL1_GOAL.y - 12) beta = 12;
    if (pos.x < LEVEL1_GOAL.x - 14) gamma = 15;
    else if (pos.x > LEVEL1_GOAL.x + 14) gamma = -14;
    await setCdpTilt(page, { beta, gamma });
    await sleep(180);
  }
  throw new Error("CDP tilt: timeout bez výhry na úrovni 1");
}

export async function assertMenuHiddenAfterPlay(page: Page): Promise<void> {
  await expect(page.locator("#tilt-maze-menu")).toBeHidden({ timeout: 15000 });
}

export async function startGameFromMenu(
  page: Page,
  levelIndex = 0,
  queryExtra = "",
  cdpPrime?: { beta: number; gamma: number }
): Promise<void> {
  const base = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");
  const q = queryExtra ? `&${queryExtra.replace(/^&/, "")}` : "";
  await page.goto(`${base}?e2e=1${q}`, { waitUntil: "domcontentloaded" });
  if (cdpPrime) await setCdpTilt(page, cdpPrime);
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });
  await page.locator(`button[data-level-index="${levelIndex}"]`).click();
  await page.locator("#menu-btn-play").click();
  if (cdpPrime) await setCdpTilt(page, cdpPrime);
  await assertMenuHiddenAfterPlay(page);
  await expect(page.locator("#tilt-maze-ui")).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(
    () => {
      const scene = (window as unknown as {
        __tiltMazeScene?: { running: boolean; ball?: { body?: unknown } };
      }).__tiltMazeScene;
      return scene?.running === true && scene.ball?.body != null;
    },
    undefined,
    { timeout: 20000 }
  );
  await sleep(600);
}

/** Zavře banner senzorů přes skutečné UI (počítač bez CDP orientace). */
export async function dismissSensorBannerIfPresent(page: Page): Promise<void> {
  const dismiss = page.locator("#sensor-dismiss");
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await expect(page.locator("#tilt-maze-sensor-warn")).toHaveCount(0);
  }
}

export async function driveMouseTilt(
  page: Page,
  dir: { nx: number; ny: number },
  holdMs = 600
): Promise<void> {
  await page.getByRole("button", { name: "Myš", exact: true }).click();
  const canvas = page.locator("#game-container canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Chybí canvas pro ovládání myší");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const scale = 0.42;
  await page.mouse.move(cx + (box.width / 2) * dir.nx * scale, cy + (box.height / 2) * dir.ny * scale);
  await sleep(holdMs);
}
