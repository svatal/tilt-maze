import { expect, type CDPSession, type Page } from "@playwright/test";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** tiltMapping treats orientation older than 550ms as gone, and this Chromium emits that event once per override. */
const ORIENTATION_REFRESH_MS = 200;
const MOTION_ACCEL = 6.2;

const ORIENTATION_COMMANDS = [
  "Emulation.setDeviceOrientationOverride",
  "DeviceOrientation.setDeviceOrientationOverride",
  "Page.setDeviceOrientationOverride"
] as const;

type OrientationCommand = (typeof ORIENTATION_COMMANDS)[number];

const CLEAR_ORIENTATION: Record<OrientationCommand, string> = {
  "Emulation.setDeviceOrientationOverride": "Emulation.clearDeviceOrientationOverride",
  "DeviceOrientation.setDeviceOrientationOverride": "DeviceOrientation.clearDeviceOrientationOverride",
  "Page.setDeviceOrientationOverride": "Page.clearDeviceOrientationOverride"
};

export type CdpTilt = {
  beta: number;
  gamma: number;
  alpha?: number;
};

export type CdpTiltSession = {
  page: Page;
  cdp: CDPSession;
};

export type CdpTiltStatus = {
  orientationCommand?: OrientationCommand;
  sensorOverride: "untried" | "ok" | "unavailable";
  gravityOverride: "untried" | "ok" | "unavailable";
  sensorError?: string;
};

type Binding = {
  page: Page;
  cdp: CDPSession;
  angles: { alpha: number; beta: number; gamma: number };
  orientationCommand?: OrientationCommand;
  refreshTimer?: ReturnType<typeof setInterval>;
  sensorsEnabled: boolean;
  sensorOverride: CdpTiltStatus["sensorOverride"];
  gravityOverride: CdpTiltStatus["gravityOverride"];
  sensorError?: string;
};

const bindings = new WeakMap<Page, Binding>();

async function sendCdp(cdp: CDPSession, method: string, params?: object): Promise<void> {
  await (cdp.send as (method: string, params?: object) => Promise<void>)(method, params);
}

export async function grantCdpSensorPermissions(page: Page): Promise<void> {
  await page.context().grantPermissions(["accelerometer", "gyroscope", "magnetometer"]);
}

async function ensureBinding(page: Page): Promise<Binding> {
  let binding = bindings.get(page);
  if (!binding) {
    await grantCdpSensorPermissions(page);
    const cdp = await page.context().newCDPSession(page);
    binding = {
      page,
      cdp,
      angles: { alpha: 0, beta: 0, gamma: 0 },
      sensorsEnabled: false,
      sensorOverride: "untried",
      gravityOverride: "untried"
    };
    bindings.set(page, binding);
    page.on("close", () => {
      if (binding?.refreshTimer) clearInterval(binding.refreshTimer);
    });
  }
  return binding;
}

function accelFromTilt(beta: number, gamma: number): { x: number; y: number; z: number } {
  const rad = Math.PI / 180;
  return {
    x: Math.sin(gamma * rad) * MOTION_ACCEL,
    y: Math.sin(beta * rad) * MOTION_ACCEL,
    z: 9.81
  };
}

async function enableSensor(binding: Binding, type: "accelerometer" | "gravity"): Promise<boolean> {
  try {
    await binding.cdp.send("Emulation.setSensorOverrideEnabled", { enabled: true, type });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes("already overridden");
  }
}

async function probeGravityThenDisable(binding: Binding): Promise<void> {
  if (binding.gravityOverride !== "untried") return;
  const ok = await enableSensor(binding, "gravity");
  binding.gravityOverride = ok ? "ok" : "unavailable";
  // A live GravitySensor adds a z term that throws the level-1 line into the top wall.
  await binding.cdp
    .send("Emulation.setSensorOverrideEnabled", { enabled: false, type: "gravity" })
    .catch(() => undefined);
}

async function enableMotionSensors(binding: Binding): Promise<boolean> {
  await probeGravityThenDisable(binding);
  if (binding.sensorsEnabled) return true;
  const ok = await enableSensor(binding, "accelerometer");
  binding.sensorsEnabled = ok;
  binding.sensorOverride = ok ? "ok" : "unavailable";
  if (!ok) binding.sensorError = "accelerometer override unavailable";
  return ok;
}

async function sendAngles(binding: Binding): Promise<void> {
  const params = binding.angles;
  if (!binding.orientationCommand) {
    const errors: string[] = [];
    for (const command of ORIENTATION_COMMANDS) {
      try {
        await sendCdp(binding.cdp, command, params);
        binding.orientationCommand = command;
        break;
      } catch (err) {
        errors.push(err instanceof Error ? err.message.split("\n")[0] : String(err));
      }
    }
    if (!binding.orientationCommand) {
      throw new Error(errors.join(" | "));
    }
  } else {
    await sendCdp(binding.cdp, binding.orientationCommand, params);
  }

  if (await enableMotionSensors(binding)) {
    const xyz = accelFromTilt(params.beta, params.gamma);
    await binding.cdp.send("Emulation.setSensorOverrideReadings", {
      type: "accelerometer",
      reading: { xyz }
    });
  }
}

function holdAngles(binding: Binding): void {
  if (binding.refreshTimer) return;
  binding.refreshTimer = setInterval(() => {
    void sendAngles(binding).catch(() => undefined);
  }, ORIENTATION_REFRESH_MS);
}

function sessionOf(binding: Binding): CdpTiltSession {
  return { page: binding.page, cdp: binding.cdp };
}

export function cdpTiltStatus(page: Page): CdpTiltStatus {
  const binding = bindings.get(page);
  if (!binding) return { sensorOverride: "untried", gravityOverride: "untried" };
  return {
    orientationCommand: binding.orientationCommand,
    sensorOverride: binding.sensorOverride,
    gravityOverride: binding.gravityOverride,
    sensorError: binding.sensorError
  };
}

async function applyTilt(page: Page, tilt: CdpTilt): Promise<Binding> {
  const binding = await ensureBinding(page);
  binding.angles = { alpha: tilt.alpha ?? 0, beta: tilt.beta, gamma: tilt.gamma };
  await sendAngles(binding);
  return binding;
}

export async function setCdpTilt(page: Page, tilt: CdpTilt): Promise<CdpTiltSession> {
  return sessionOf(await applyTilt(page, tilt));
}

export async function startCdpDeviceOrientation(
  page: Page,
  beta: number,
  gamma: number,
  alpha = 0
): Promise<CdpTiltSession> {
  const binding = await applyTilt(page, { beta, gamma, alpha });
  holdAngles(binding);
  return sessionOf(binding);
}

export async function stopCdpDeviceOrientation(session: CdpTiltSession): Promise<void> {
  const binding = bindings.get(session.page);
  if (!binding) return;
  if (binding.refreshTimer) {
    clearInterval(binding.refreshTimer);
    binding.refreshTimer = undefined;
  }
  if (binding.orientationCommand) {
    await sendCdp(binding.cdp, CLEAR_ORIENTATION[binding.orientationCommand]).catch(() => undefined);
  }
  if (binding.sensorsEnabled) {
    await binding.cdp
      .send("Emulation.setSensorOverrideEnabled", { enabled: false, type: "accelerometer" })
      .catch(() => undefined);
    binding.sensorsEnabled = false;
  }
}

export async function tryEnableCdpSensorOverrides(page: Page): Promise<boolean> {
  const binding = await ensureBinding(page);
  return enableMotionSensors(binding);
}

export async function stopCdpTiltForPage(page: Page): Promise<void> {
  const binding = bindings.get(page);
  if (!binding) return;
  await stopCdpDeviceOrientation(sessionOf(binding));
}

export async function dispatchDeviceOrientation(page: Page, beta: number, gamma = 0): Promise<void> {
  const expectedY = Math.sin((beta * Math.PI) / 180) * MOTION_ACCEL;
  await startCdpDeviceOrientation(page, beta, gamma, 0);
  await page.waitForFunction(
    ({ beta, expectedY }) => {
      const scene = (window as unknown as {
        __tiltMazeScene?: {
          tilt: {
            getSensorSnapshot: () => { lastBeta: number | null; lastGrav: { y: number } | null };
          };
        };
      }).__tiltMazeScene;
      const snap = scene?.tilt.getSensorSnapshot();
      if (!snap) return false;
      const betaOk = snap.lastBeta != null && Math.abs(snap.lastBeta - beta) < 1;
      const gravOk = snap.lastGrav != null && Math.abs(snap.lastGrav.y - expectedY) < 0.5;
      return betaOk || gravOk;
    },
    { beta, expectedY },
    { timeout: 3000 }
  );
  await sleep(80);
}

export async function assertMenuHiddenAfterPlay(page: Page): Promise<void> {
  await expect(page.locator("#tilt-maze-menu")).toBeHidden({ timeout: 15000 });
}

export async function startGameFromMenu(page: Page, levelIndex = 0): Promise<void> {
  await grantCdpSensorPermissions(page);
  await page.goto(`${(process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/")}?e2e=1`, {
    waitUntil: "domcontentloaded"
  });
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });
  await page.locator(`button[data-level-index="${levelIndex}"]`).click();
  // devicemotion keeps the virtual accelerometer only when the override exists before GameScene listens.
  await startCdpDeviceOrientation(page, 0, 0);
  await page.locator("#menu-btn-play").click();
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
  // finishBeginPlay calibrates after the ball exists. Wait so a later tilt is not stored as the zero point.
  await sleep(600);
}

/** Zapne režim Myš a drží kurzor v normalizovaném směru (−1…1) uvnitř canvasu. */
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

/** Level 1 open board. Start is bottom-left, goal is top-right. Negative beta rolls up, positive gamma rolls right. */
export const LEVEL1_CDP_TILT_PHASES: { beta: number; gamma: number; ms: number }[] = [
  { beta: 0, gamma: 0, ms: 900 },
  { beta: -40, gamma: 15, ms: 12000 }
];

export async function runCdpTiltPhases(
  page: Page,
  phases: { beta: number; gamma: number; ms: number }[]
): Promise<CdpTiltSession> {
  let session: CdpTiltSession | undefined;
  for (const phase of phases) {
    session = await startCdpDeviceOrientation(page, phase.beta, phase.gamma);
    await sleep(phase.ms);
  }
  if (!session) throw new Error("CDP tilt phases are empty");
  return session;
}
