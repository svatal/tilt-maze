import { expect, type CDPSession, type Page } from "@playwright/test";

/** Game ignores orientation samples older than 550ms (`src/tiltMapping.ts`); one CDP override emits once. */
const ORIENTATION_REFRESH_MS = 200;

/** E2E physics steps use fixed dt (must match `GameScene.e2eAdvanceSimulation` default). */
export const E2E_SIM_DT_MS = 1000 / 60;
const E2E_SIM_STEPS_PER_CD_LOOK = Math.round(300 / E2E_SIM_DT_MS);

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

type SceneTilt = {
  running: boolean;
  ball?: { x: number; y: number; body?: unknown };
  game?: { loop?: { frame?: number } };
  tilt: {
    getSensorSnapshot: () => { orientValid: number };
    update: (d: number, s: number) => { ax: number; ay: number };
  };
};

/** After play starts: HUD running, ball body exists, a few Matter frames elapsed. */
async function waitForGamePlayReady(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const scene = (window as unknown as { __tiltMazeScene?: SceneTilt }).__tiltMazeScene;
      if (scene?.running !== true || scene.ball?.body == null) return false;
      const frame = scene.game?.loop?.frame ?? 0;
      return frame >= 8;
    },
    undefined,
    { timeout: timeoutMs }
  );
}

/** CDP override must produce at least one valid deviceorientation before driving physics. */
async function waitForOrientationFeed(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const scene = (window as unknown as { __tiltMazeScene?: SceneTilt }).__tiltMazeScene;
      const snap = scene?.tilt.getSensorSnapshot();
      return (snap?.orientValid ?? 0) > 0;
    },
    undefined,
    { timeout: timeoutMs }
  );
}

async function readBallXY(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const b = (window as unknown as { __tiltMazeScene?: SceneTilt }).__tiltMazeScene?.ball;
    return { x: b?.x ?? 0, y: b?.y ?? 0 };
  });
}

const LEVEL1_GOAL = { x: 248, y: 118 };

async function advanceSimulation(page: Page, steps: number): Promise<void> {
  await page.evaluate(
    ([n, dt]) => {
      const w = window as unknown as { __e2eUnpinBall?: () => void; __e2eAdvanceSimulation?: (s: number, d?: number) => void };
      w.__e2eUnpinBall?.();
      w.__e2eAdvanceSimulation?.(n, dt);
    },
    [steps, E2E_SIM_DT_MS] as [number, number]
  );
}

export async function driveCdpTiltToLevel1Goal(page: Page, simBudgetMs = 50_000): Promise<void> {
  const maxSteps = Math.ceil(simBudgetMs / E2E_SIM_DT_MS);
  await page.evaluate(() => {
    (window as unknown as { __e2eSetDriveMode?: (on: boolean) => void }).__e2eSetDriveMode?.(true);
  });
  try {
    await setCdpTilt(page, { beta: 8, gamma: 6 });
    await waitForOrientationFeed(page);
    await advanceSimulation(page, E2E_SIM_STEPS_PER_CD_LOOK * 3);

    let simSteps = 0;
    while (simSteps < maxSteps) {
      if (await page.locator("#btn-next").isVisible().catch(() => false)) return;
      const pos = await readBallXY(page);
      let beta = 0;
      let gamma = 0;
      if (pos.y > LEVEL1_GOAL.y + 18) beta = -38;
      else if (pos.y < LEVEL1_GOAL.y - 12) beta = 12;
      if (pos.x < LEVEL1_GOAL.x - 14) gamma = 15;
      else if (pos.x > LEVEL1_GOAL.x + 14) gamma = -14;
      await setCdpTilt(page, { beta, gamma });
      await advanceSimulation(page, E2E_SIM_STEPS_PER_CD_LOOK);
      simSteps += E2E_SIM_STEPS_PER_CD_LOOK;
    }
    throw new Error("CDP tilt: timeout bez výhry na úrovni 1");
  } finally {
    await page.evaluate(() => {
      (window as unknown as { __e2eSetDriveMode?: (on: boolean) => void }).__e2eSetDriveMode?.(false);
    });
  }
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
  await dismissSensorBannerIfPresent(page);
  await page.locator(`button[data-level-index="${levelIndex}"]`).click();
  if (cdpPrime) await setCdpTilt(page, cdpPrime);
  await assertMenuHiddenAfterPlay(page);
  await expect(page.locator("#tilt-maze-ui")).toBeVisible({ timeout: 10000 });
  await dismissSensorBannerIfPresent(page);
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
  await waitForGamePlayReady(page);
  if (cdpPrime) await waitForOrientationFeed(page, 12_000).catch(() => undefined);
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
  await page.mouse.move(
    cx + (box.width / 2) * dir.nx * scale,
    cy + (box.height / 2) * dir.ny * scale
  );
  await page.waitForFunction(
    () => {
      const scene = (window as unknown as { __tiltMazeScene?: SceneTilt }).__tiltMazeScene;
      const t = scene?.tilt.update(16, 1) ?? { ax: 0, ay: 0 };
      return Math.hypot(t.ax, t.ay) > 0.02;
    },
    undefined,
    { timeout: 5_000 }
  );
  const steps = Math.max(1, Math.round(holdMs / E2E_SIM_DT_MS));
  await advanceSimulation(page, steps);
}