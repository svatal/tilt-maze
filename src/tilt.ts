/**
 * Naklonění zařízení + klávesnice (fallback) → normalizovaný vektor zrychlení.
 * DOM: DeviceOrientation + DeviceMotion; volitelně Generic Sensor API (GravitySensor).
 */

const SMOOTH = 0.18;
const KEY_FORCE = 1.2;
const STALE_MS = 1200;
const WARN_THROTTLE_MS = 8000;

type GravitySensorCtor = new (opts?: { frequency?: number }) => {
  addEventListener: (ev: "reading" | "error", fn: () => void) => void;
  start: () => void;
  stop: () => void;
  x: number;
  y: number;
  z: number;
};

export type TiltOutput = { ax: number; ay: number };

export type TiltControllerOptions = {
  /** Voláno když ~1,2 s po Start nepřijdou žádná platná data ze senzorů */
  onSensorDataStale?: () => void;
};

async function tryGravitySensor(onReading: (x: number, y: number, z: number) => void): Promise<(() => void) | null> {
  const GravitySensor = (globalThis as unknown as { GravitySensor?: GravitySensorCtor }).GravitySensor;
  if (typeof GravitySensor !== "function") return null;
  try {
    if (navigator.permissions?.query) {
      try {
        await navigator.permissions.query({ name: "accelerometer" as PermissionName });
      } catch {
        /* některé prohlížeče nemají tento PermissionName v TS */
      }
    }
    const s = new GravitySensor({ frequency: 30 });
    const onRead = (): void => onReading(s.x, s.y, s.z);
    s.addEventListener("reading", onRead);
    s.start();
    return () => {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    };
  } catch {
    return null;
  }
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
  /** DeviceMotion accelerationIncludingGravity (m/s²) */
  private gravX = 0;
  private gravY = 0;
  private calGravX = 0;
  private calGravY = 0;
  private lastMotionTs = 0;
  /** GravitySensor (m/s²) když DOM nic nedává */
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
    this.lastOrientTs = performance.now();
    this.lastMotionTs = performance.now();
    this.lastGravSensorTs = performance.now();
  }

  private checkSensorHealth(): void {
    if (!this.options.onSensorDataStale) return;
    if (this.keyTilt.x !== 0 || this.keyTilt.y !== 0) {
      this.markActivityFromKeyboard();
      return;
    }
    const t = performance.now();
    const last = Math.max(this.lastOrientTs, this.lastMotionTs, this.lastGravSensorTs);
    if (t - last < STALE_MS) return;
    if (t - this.lastStaleWarn < WARN_THROTTLE_MS) return;
    this.lastStaleWarn = t;
    this.options.onSensorDataStale?.();
  }

  /** Kalibrace: aktuální poloha = neutrální */
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

    window.addEventListener("deviceorientation", this.onOrientation as EventListener, { passive: true });
    window.addEventListener("devicemotion", this.onMotion as EventListener, { passive: true });
    this.listening = true;

    const now = performance.now();
    this.lastOrientTs = now;
    this.lastMotionTs = now;
    this.lastGravSensorTs = now;

    this.stopGravitySensor = await tryGravitySensor((x, y, z) => {
      this.gsX = x;
      this.gsY = y;
      this.gsZ = z;
      this.hasGravitySample = true;
      this.lastGravSensorTs = performance.now();
    });

    if (this.options.onSensorDataStale) {
      this.healthTimer = setInterval(() => this.checkSensorHealth(), 400);
    }
  }

  private readonly onOrientation = (e: DeviceOrientationEvent): void => {
    let ok = false;
    if (e.gamma != null && !Number.isNaN(e.gamma)) {
      this.lastGamma = e.gamma;
      ok = true;
    }
    if (e.beta != null && !Number.isNaN(e.beta)) {
      this.lastBeta = e.beta;
      ok = true;
    }
    if (ok) this.lastOrientTs = performance.now();
  };

  private readonly onMotion = (e: DeviceMotionEvent): void => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null) return;
    this.gravX = g.x;
    this.gravY = g.y;
    this.lastMotionTs = performance.now();
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

  /**
   * Vrátí „gravitační“ zrychlení v jednotkách vhodných pro Matter applyForce.
   */
  update(_dt: number, forceScale: number): TiltOutput {
    let rawX = this.keyTilt.x;
    let rawY = this.keyTilt.y;

    const recentOrient = performance.now() - this.lastOrientTs < 550;
    const haveOrientGamma = this.lastGamma !== null && recentOrient;
    const haveOrientBoth =
      this.lastGamma !== null && this.lastBeta !== null && recentOrient;

    const recentMotion = performance.now() - this.lastMotionTs < 550;
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
