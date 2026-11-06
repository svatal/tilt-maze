/**
 * Naklonění zařízení + klávesnice (fallback) → normalizovaný vektor zrychlení.
 * DOM: DeviceOrientation + DeviceMotion; volitelně Generic Sensor API (GravitySensor).
 */

import { NO_VALID_DATA_MS, SensorMonitor, querySensorPermissions } from "./sensorMonitor";

const SMOOTH = 0.18;
const KEY_FORCE = 1.2;
const WARN_THROTTLE_MS = 8000;
const HEALTH_INTERVAL_MS = 350;

type GravitySensorCtor = new (opts?: { frequency?: number }) => {
  addEventListener: (ev: "reading" | "error", fn: (ev: Event) => void) => void;
  removeEventListener: (ev: "reading" | "error", fn: (ev: Event) => void) => void;
  start: () => void;
  stop: () => void;
  x: number;
  y: number;
  z: number;
};

export type TiltOutput = { ax: number; ay: number };

export type TiltControllerOptions = {
  /** Voláno když nelze získat použitelná data ze senzorů (viz SensorMonitor) */
  onSensorDataStale?: () => void;
}

export async function requestIOSMotionPermission(): Promise<boolean> {
  const DO = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  const DM = DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  let ok = true;
  if (typeof DO.requestPermission === "function") {
    try {
      ok = (await DO.requestPermission()) === "granted";
    } catch {
      ok = false;
    }
  }
  if (ok && typeof DM.requestPermission === "function") {
    try {
      await DM.requestPermission();
    } catch {
      /* ignore */
    }
  }
  return ok;
}

export class TiltController {
  private smoothAx = 0;
  private smoothAy = 0;
  private lastGamma: number | null = null;
  private lastBeta: number | null = null;
  private lastOrientTs = 0;
  private gravX = 0;
  private gravY = 0;
  private calGravX = 0;
  private calGravY = 0;
  private lastMotionTs = 0;
  private gsX = 0;
  private gsY = 0;
  private gsZ = 0;
  private calGsX = 0;
  private calGsY = 0;
  private calGsZ = 0;
  private lastGravSensorTs = 0;
  private hasGravitySample = false;

  private calGamma = 0;
  private calBeta = 0;
  private listening = false;
  private stopGravitySensor: (() => void) | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private lastStaleWarn = 0;

  readonly monitor = new SensorMonitor();

  private readonly keyTilt = { x: 0, y: 0 };
  private readonly options: TiltControllerOptions;

  constructor(options: TiltControllerOptions = {}) {
    this.options = options;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.teardownSensors();
  }

  getSensorSnapshot() {
    return this.monitor.snapshot();
  }

  isKeyboardActive(): boolean {
    return this.keyTilt.x !== 0 || this.keyTilt.y !== 0;
  }

  private teardownSensors(): void {
    if (this.listening) {
      window.removeEventListener("deviceorientation", this.onOrientation as EventListener);
      window.removeEventListener("devicemotion", this.onMotion as EventListener);
      this.listening = false;
    }
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    if (this.stopGravitySensor) {
      this.stopGravitySensor();
      this.stopGravitySensor = null;
    }
  }

  private markActivityFromKeyboard(): void {
    const t = performance.now();
    this.lastOrientTs = t;
    this.lastMotionTs = t;
    this.lastGravSensorTs = t;
    this.monitor.markKeyboardOverride(t);
  }

  private checkSensorHealth(): void {
    if (!this.options.onSensorDataStale) return;
    const keyboard = this.keyTilt.x !== 0 || this.keyTilt.y !== 0;
    if (keyboard) {
      this.markActivityFromKeyboard();
      return;
    }
    const t = performance.now();
    if (this.monitor.shouldWarnNoValidData(t, false)) {
      if (t - this.lastStaleWarn < WARN_THROTTLE_MS) return;
      this.lastStaleWarn = t;
      this.options.onSensorDataStale();
    }
  }

  calibrate(): void {
    if (this.lastGamma !== null) this.calGamma = this.lastGamma;
    if (this.lastBeta !== null) this.calBeta = this.lastBeta;
    this.calGravX = this.gravX;
    this.calGravY = this.gravY;
    this.calGsX = this.gsX;
    this.calGsY = this.gsY;
    this.calGsZ = this.gsZ;
  }

  async startSensors(): Promise<void> {
    this.teardownSensors();

    const perms = await querySensorPermissions();
    this.monitor.setPermissionStates(perms.accel, perms.gyro, perms.mag);

    const t0 = performance.now();
    this.monitor.start(t0);

    window.addEventListener("deviceorientation", this.onOrientation as EventListener, { passive: true });
    window.addEventListener("devicemotion", this.onMotion as EventListener, { passive: true });
    this.listening = true;

    this.lastOrientTs = 0;
    this.lastMotionTs = 0;
    this.lastGravSensorTs = 0;

    await this.tryInitGravitySensor();

    if (this.options.onSensorDataStale) {
      this.healthTimer = setInterval(() => this.checkSensorHealth(), HEALTH_INTERVAL_MS);
    }
  }

  private async tryInitGravitySensor(): Promise<void> {
    const GravitySensor = (globalThis as unknown as { GravitySensor?: GravitySensorCtor }).GravitySensor;
    if (typeof GravitySensor !== "function") {
      this.monitor.setGravityConstructorResult(false);
      return;
    }
    try {
      const s = new GravitySensor({ frequency: 30 });
      const onRead = (): void => {
        const at = performance.now();
        this.gsX = s.x;
        this.gsY = s.y;
        this.gsZ = s.z;
        this.hasGravitySample = true;
        this.lastGravSensorTs = at;
        this.monitor.recordGravityReading(s.x, s.y, s.z, at);
      };
      const onErr = (ev: Event): void => {
        this.monitor.recordGravitySensorError(ev);
      };
      s.addEventListener("reading", onRead);
      s.addEventListener("error", onErr);
      s.start();
      this.monitor.setGravityConstructorResult(true);
      this.stopGravitySensor = () => {
        try {
          s.removeEventListener("reading", onRead);
          s.removeEventListener("error", onErr);
          s.stop();
        } catch {
          /* ignore */
        }
      };
    } catch (e) {
      this.monitor.setGravityConstructorResult(false, e);
    }
  }

  private readonly onOrientation = (e: DeviceOrientationEvent): void => {
    const at = performance.now();
    this.monitor.recordOrientation(e, at);

    let ok = false;
    if (e.gamma != null && Number.isFinite(e.gamma)) {
      this.lastGamma = e.gamma;
      ok = true;
    }
    if (e.beta != null && Number.isFinite(e.beta)) {
      this.lastBeta = e.beta;
      ok = true;
    }
    if (ok) this.lastOrientTs = at;
  };

  private readonly onMotion = (e: DeviceMotionEvent): void => {
    const at = performance.now();
    this.monitor.recordMotion(e, at);

    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null || !Number.isFinite(g.x) || !Number.isFinite(g.y)) return;
    this.gravX = g.x;
    this.gravY = g.y;
    this.lastMotionTs = at;
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") this.keyTilt.x = -KEY_FORCE;
    if (k === "arrowright" || k === "d") this.keyTilt.x = KEY_FORCE;
    if (k === "arrowup" || k === "w") this.keyTilt.y = -KEY_FORCE;
    if (k === "arrowdown" || k === "s") this.keyTilt.y = KEY_FORCE;
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a" || k === "arrowright" || k === "d") this.keyTilt.x = 0;
    if (k === "arrowup" || k === "w" || k === "arrowdown" || k === "s") this.keyTilt.y = 0;
  };

  update(_dt: number, forceScale: number): TiltOutput {
    let rawX = this.keyTilt.x;
    let rawY = this.keyTilt.y;

    const recentOrient = this.lastOrientTs > 0 && performance.now() - this.lastOrientTs < 550;
    const haveOrientGamma = this.lastGamma !== null && recentOrient;
    const haveOrientBoth =
      this.lastGamma !== null && this.lastBeta !== null && recentOrient;

    const recentMotion = this.lastMotionTs > 0 && performance.now() - this.lastMotionTs < 550;
    const haveMotion =
      recentMotion &&
      (Math.abs(this.gravX - this.calGravX) > 0.08 || Math.abs(this.gravY - this.calGravY) > 0.08);

    if (haveOrientBoth) {
      const g = (this.lastGamma! - this.calGamma) * (Math.PI / 180);
      const b = (this.lastBeta! - this.calBeta) * (Math.PI / 180);
      rawX += Math.sin(g) * 2.2;
      rawY += -Math.sin(b) * 2.2;
    } else if (haveOrientGamma) {
      const g = (this.lastGamma! - this.calGamma) * (Math.PI / 180);
      rawX += Math.sin(g) * 2.2;
    } else if (haveMotion) {
      const dx = this.gravX - this.calGravX;
      const dy = this.gravY - this.calGravY;
      rawX += dx * 0.35;
      rawY += -dy * 0.35;
    } else if (this.hasGravitySample && performance.now() - this.lastGravSensorTs < 600) {
      const dx = this.gsX - this.calGsX;
      const dy = this.gsY - this.calGsY;
      const dz = this.gsZ - this.calGsZ;
      const nx = dx / 9.81;
      const ny = dy / 9.81;
      const nz = dz / 9.81;
      rawX += nx * 2.4;
      rawY += -ny * 2.4;
      if (Math.abs(nz) > 0.12) {
        rawY += nz * 0.8;
      }
    }

    rawX = Math.max(-2.8, Math.min(2.8, rawX));
    rawY = Math.max(-2.8, Math.min(2.8, rawY));

    this.smoothAx += (rawX * forceScale - this.smoothAx) * SMOOTH;
    this.smoothAy += (rawY * forceScale - this.smoothAy) * SMOOTH;

    return { ax: this.smoothAx, ay: this.smoothAy };
  }
}

export { NO_VALID_DATA_MS };
