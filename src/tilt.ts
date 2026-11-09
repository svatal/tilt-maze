/**
 * Naklonění zařízení nebo myš (vzájemně výlučné) → normalizovaný vektor zrychlení.
 * DOM: DeviceOrientation + DeviceMotion; volitelně Generic Sensor API (GravitySensor).
 */

import { MouseTiltInput } from "./mouseTiltInput";
import type { PlayAreaRect } from "./mouseTiltMapping";
import { SensorMonitor, querySensorPermissions } from "./sensorMonitor";
import { computeRawTiltAxes } from "./tiltMapping";

const SMOOTH = 0.18;
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
  /** Desktop / žádné DOM senzory — krátká nápověda (jednou v relaci řeší UI) */
  onSensorDesktopHint?: () => void;
  /** Blokace (Brave), null data, zamítnutí oprávnění, … — plné upozornění */
  onSensorDataStale?: () => void;
  /** Přišla platná data ze senzoru — skrýt banner a už nezobrazovat */
  onSensorDataRecovered?: () => void;
  getPlayArea?: () => PlayAreaRect;
  isUiTarget?: (el: EventTarget | null) => boolean;
  onMouseArmedChange?: (armed: boolean) => void;
  onMouseTiltVisual?: (nx: number, ny: number, active: boolean) => void;
};

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
  private recoveryNotified = false;

  readonly monitor = new SensorMonitor();

  private readonly options: TiltControllerOptions;
  private mouseInput: MouseTiltInput | null = null;

  constructor(options: TiltControllerOptions = {}) {
    this.options = options;
    window.addEventListener("keydown", this.onKeyDown);
    if (options.getPlayArea) {
      this.mouseInput = new MouseTiltInput({
        getPlayArea: options.getPlayArea,
        isUiTarget: options.isUiTarget ?? (() => false),
        onArmedChange: (a) => options.onMouseArmedChange?.(a),
        onPointerTiltChange: (x, y, nx, ny, active) => {
          void x;
          void y;
          options.onMouseTiltVisual?.(nx, ny, active);
        }
      });
    }
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.mouseInput?.destroy();
    this.mouseInput = null;
    this.teardownSensors();
  }

  getSensorSnapshot() {
    return this.monitor.snapshot();
  }

  isMouseArmed(): boolean {
    return this.mouseInput?.isArmed() ?? false;
  }

  setMouseArmed(v: boolean): void {
    this.mouseInput?.setArmed(v);
  }

  toggleMouseArmed(): void {
    this.mouseInput?.toggleArmed();
  }

  isDesktopInputOverride(): boolean {
    return this.isMouseArmed();
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

  private markActivityFromMouse(): void {
    const t = performance.now();
    this.monitor.markManualInputOverride(t);
  }

  private checkSensorHealth(): void {
    const { onSensorDesktopHint, onSensorDataStale, onSensorDataRecovered } = this.options;
    if (!onSensorDesktopHint && !onSensorDataStale && !onSensorDataRecovered) return;
    const mouseSnap = this.mouseInput?.snapshot();
    const mouseDriving =
      mouseSnap?.armed &&
      mouseSnap.windowFocused &&
      mouseSnap.pointerInside &&
      (mouseSnap.rawX !== 0 || mouseSnap.rawY !== 0);
    if (mouseDriving) {
      this.markActivityFromMouse();
      return;
    }
    const t = performance.now();
    const issue = this.monitor.classifySensorIssue(t);

    if (issue === "ok") {
      if (this.monitor.hadRealSensorValid && !this.recoveryNotified) {
        this.recoveryNotified = true;
        onSensorDataRecovered?.();
      }
      return;
    }

    if (issue === "no_sensors_desktop") {
      onSensorDesktopHint?.();
      return;
    }

    onSensorDataStale?.();
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
    if (e.key.toLowerCase() !== "m" || !this.mouseInput || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    e.preventDefault();
    this.mouseInput.toggleArmed();
  };

  update(_dt: number, forceScale: number): TiltOutput {
    const now = performance.now();
    const mouseSnap = this.mouseInput?.snapshot();
    const mouseTilt = this.mouseInput?.getRawTilt() ?? { x: 0, y: 0 };
    const { rawX, rawY } = computeRawTiltAxes({
      lastGamma: this.lastGamma,
      lastBeta: this.lastBeta,
      calGamma: this.calGamma,
      calBeta: this.calBeta,
      gravX: this.gravX,
      gravY: this.gravY,
      calGravX: this.calGravX,
      calGravY: this.calGravY,
      gsX: this.gsX,
      gsY: this.gsY,
      gsZ: this.gsZ,
      calGsX: this.calGsX,
      calGsY: this.calGsY,
      calGsZ: this.calGsZ,
      mouseX: mouseTilt.x,
      mouseY: mouseTilt.y,
      mouseArmed: mouseSnap?.armed ?? false,
      mousePointerInside: mouseSnap?.pointerInside ?? false,
      mouseWindowFocused: mouseSnap?.windowFocused ?? true,
      lastOrientTs: this.lastOrientTs,
      lastMotionTs: this.lastMotionTs,
      lastGravSensorTs: this.lastGravSensorTs,
      hasGravitySample: this.hasGravitySample,
      now
    });

    this.smoothAx += (rawX * forceScale - this.smoothAx) * SMOOTH;
    this.smoothAy += (rawY * forceScale - this.smoothAy) * SMOOTH;

    return { ax: this.smoothAx, ay: this.smoothAy };
  }
}
