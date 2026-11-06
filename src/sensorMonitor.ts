/**
 * Detekce blokovaných / neplatných senzorů (události s null, jen nuly, beze změny).
 * Čistá logika pro unit testy.
 */

export const NO_VALID_DATA_MS = 1800;
export const ZERO_STALL_MS = 1800;
export const MOTION_MAG_EPS = 0.25;
export const ORIENT_ANGLE_EPS = 0.35;

export type PermissionNameExt = "accelerometer" | "gyroscope" | "magnetometer";

export type SensorMonitorSnapshot = {
  orientEvents: number;
  orientValid: number;
  motionEvents: number;
  motionValid: number;
  gsReadings: number;
  gsErrors: number;
  gsConstructorOk: boolean | null;
  lastGamma: number | null;
  lastBeta: number | null;
  lastGrav: { x: number; y: number; z: number | null } | null;
  lastGs: { x: number; y: number; z: number } | null;
  permAccel: PermissionState | "unsupported";
  permGyro: PermissionState | "unsupported";
  permMag: PermissionState | "unsupported";
  permissionDenied: boolean;
  gravityConstructorFailed: boolean;
  lastGravityError: string | null;
};

function fin(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export type SensorIssueKind = "ok" | "no_sensors_desktop" | "sensor_blocked_or_invalid";

export class SensorMonitor {
  startedAt = 0;

  orientEvents = 0;
  orientValid = 0;
  motionEvents = 0;
  motionValid = 0;
  gsReadings = 0;
  gsErrors = 0;

  gsConstructorOk: boolean | null = null;
  gravityConstructorFailed = false;
  lastGravityError: string | null = null;

  /** Byla někdy přijata použitelná data ze skutečného senzoru (ne klávesnicí). */
  hadRealSensorValid = false;

  lastGamma: number | null = null;
  lastBeta: number | null = null;
  lastGrav: { x: number; y: number; z: number | null } | null = null;
  lastGs: { x: number; y: number; z: number } | null = null;

  /** Naposledy, kdy měl vzorek rozumnou amplitudu (tilt použitelný) */
  lastValidSampleAt = 0;

  lastMotionEventAt = 0;
  lastOrientEventAt = 0;

  private motionMagHistory: number[] = [];

  permAccel: PermissionState | "unsupported" = "unsupported";
  permGyro: PermissionState | "unsupported" = "unsupported";
  permMag: PermissionState | "unsupported" = "unsupported";
  permissionDenied = false;

  start(at: number): void {
    this.startedAt = at;
    this.lastValidSampleAt = 0;
    this.lastMotionEventAt = 0;
    this.lastOrientEventAt = 0;
    this.motionMagHistory = [];
    this.hadRealSensorValid = false;
  }

  markKeyboardOverride(at: number): void {
    this.lastValidSampleAt = at;
  }

  setPermissionStates(
    accel: PermissionState | "unsupported",
    gyro: PermissionState | "unsupported",
    mag: PermissionState | "unsupported"
  ): void {
    this.permAccel = accel;
    this.permGyro = gyro;
    this.permMag = mag;
    this.permissionDenied = [accel, gyro, mag].some((p) => p === "denied");
  }

  setGravityConstructorResult(ok: boolean, err?: unknown): void {
    this.gsConstructorOk = ok;
    if (ok) {
      this.gravityConstructorFailed = false;
      this.lastGravityError = null;
      return;
    }
    /** Bez `err` = API v prohlížeči chybí (typ. desktop), nikoli uživatelská chyba. */
    this.gravityConstructorFailed = err !== undefined;
    if (this.gravityConstructorFailed) {
      this.lastGravityError = err instanceof Error ? err.message : err != null ? String(err) : "constructor failed";
    } else {
      this.lastGravityError = null;
    }
  }

  recordGravitySensorError(err: unknown): void {
    this.gsErrors += 1;
    this.lastGravityError = err instanceof Error ? err.message : String(err);
  }

  recordOrientation(e: DeviceOrientationEvent, at: number): void {
    this.orientEvents += 1;
    this.lastOrientEventAt = at;

    const g = e.gamma;
    const b = e.beta;
    const hasNum = (fin(g) && Math.abs(g) > ORIENT_ANGLE_EPS) || (fin(b) && Math.abs(b) > ORIENT_ANGLE_EPS);

    if (hasNum) {
      this.orientValid += 1;
      if (fin(g)) this.lastGamma = g;
      if (fin(b)) this.lastBeta = b;
      this.lastValidSampleAt = at;
      this.hadRealSensorValid = true;
    }
  }

  recordMotion(e: DeviceMotionEvent, at: number): void {
    this.motionEvents += 1;
    this.lastMotionEventAt = at;

    const g = e.accelerationIncludingGravity;
    if (!g || !fin(g.x) || !fin(g.y)) return;

    this.lastGrav = {
      x: g.x,
      y: g.y,
      z: fin(g.z) ? g.z : null
    };

    const z = fin(g.z) ? g.z! : 0;
    const mag = Math.hypot(g.x, g.y, z);
    this.pushMotionMag(mag);

    const mostlyZeros = Math.abs(g.x) < 1e-6 && Math.abs(g.y) < 1e-6 && Math.abs(z) < 1e-6;
    if (mostlyZeros) return;

    const farFromEarth = Math.abs(mag - 9.81) > MOTION_MAG_EPS || mag > MOTION_MAG_EPS * 3;
    if (farFromEarth || mag > 0.5) {
      this.motionValid += 1;
      this.lastValidSampleAt = at;
      this.hadRealSensorValid = true;
    }
  }

  recordGravityReading(x: number, y: number, z: number, at: number): void {
    if (!fin(x) || !fin(y) || !fin(z)) return;
    this.gsReadings += 1;
    this.lastGs = { x, y, z };
    const mag = Math.hypot(x, y, z);
    if (mag > 0.35) {
      this.lastValidSampleAt = at;
      this.hadRealSensorValid = true;
    }
  }

  snapshot(): SensorMonitorSnapshot {
    return {
      orientEvents: this.orientEvents,
      orientValid: this.orientValid,
      motionEvents: this.motionEvents,
      motionValid: this.motionValid,
      gsReadings: this.gsReadings,
      gsErrors: this.gsErrors,
      gsConstructorOk: this.gsConstructorOk,
      lastGamma: this.lastGamma,
      lastBeta: this.lastBeta,
      lastGrav: this.lastGrav,
      lastGs: this.lastGs,
      permAccel: this.permAccel,
      permGyro: this.permGyro,
      permMag: this.permMag,
      permissionDenied: this.permissionDenied,
      gravityConstructorFailed: this.gravityConstructorFailed,
      lastGravityError: this.lastGravityError
    };
  }

  /**
   * Rozdělí případy: desktop bez jakýchkoli senzorů (krátká nápověda) vs. blokace / neplatná data (Brave, oprávnění, …).
   */
  classifySensorIssue(now: number): SensorIssueKind {
    if (this.permissionDenied) return "sensor_blocked_or_invalid";
    if (this.gravityConstructorFailed) return "sensor_blocked_or_invalid";
    if (this.gsErrors > 0 && this.gsReadings === 0) return "sensor_blocked_or_invalid";

    if (this.lastValidSampleAt > 0) {
      if (now - this.lastValidSampleAt < NO_VALID_DATA_MS) return "ok";
      return "sensor_blocked_or_invalid";
    }

    const elapsed = now - this.startedAt;
    if (elapsed < 450) return "ok";
    if (elapsed < NO_VALID_DATA_MS) return "ok";

    const noDomEvents =
      this.motionEvents === 0 &&
      this.orientEvents === 0 &&
      this.gsReadings === 0 &&
      this.gsErrors === 0;

    if (noDomEvents && this.gsConstructorOk !== true && !this.gravityConstructorFailed) {
      return "no_sensors_desktop";
    }

    if (this.motionEvents >= 2 && this.motionValid === 0) {
      if (this.motionStuckNear9_81() || this.allMotionRecentNearZero()) {
        return "sensor_blocked_or_invalid";
      }
    }

    if (this.orientEvents >= 3 && this.orientValid === 0) {
      return "sensor_blocked_or_invalid";
    }

    if (this.motionEvents > 0 || this.orientEvents > 0 || this.gsReadings > 0 || this.gsErrors > 0) {
      return "sensor_blocked_or_invalid";
    }

    return "no_sensors_desktop";
  }

  shouldWarnNoValidData(now: number, keyboardActive: boolean): boolean {
    if (keyboardActive) return false;
    return this.classifySensorIssue(now) !== "ok";
  }

  private pushMotionMag(mag: number): void {
    this.motionMagHistory.push(mag);
    if (this.motionMagHistory.length > 14) this.motionMagHistory.shift();
  }

  private variance(a: number[]): number {
    if (a.length < 3) return Infinity;
    const mean = a.reduce((s, v) => s + v, 0) / a.length;
    return a.reduce((s, v) => s + (v - mean) ** 2, 0) / a.length;
  }

  private motionStuckNear9_81(): boolean {
    if (this.motionMagHistory.length < 8) return false;
    const v = this.variance(this.motionMagHistory);
    const mean = this.motionMagHistory.reduce((s, x) => s + x, 0) / this.motionMagHistory.length;
    return v < 0.05 && Math.abs(mean - 9.81) < 0.35;
  }

  private allMotionRecentNearZero(): boolean {
    const g = this.lastGrav;
    if (!g) return false;
    return Math.abs(g.x) < 1e-5 && Math.abs(g.y) < 1e-5;
  }
}

export async function querySensorPermissions(): Promise<{
  accel: PermissionState | "unsupported";
  gyro: PermissionState | "unsupported";
  mag: PermissionState | "unsupported";
}> {
  const out: {
    accel: PermissionState | "unsupported";
    gyro: PermissionState | "unsupported";
    mag: PermissionState | "unsupported";
  } = {
    accel: "unsupported",
    gyro: "unsupported",
    mag: "unsupported"
  };
  if (!navigator.permissions?.query) return out;
  const tryOne = async (name: PermissionNameExt): Promise<PermissionState | "unsupported"> => {
    try {
      const r = await navigator.permissions.query({ name: name as PermissionName });
      return r.state;
    } catch {
      return "unsupported";
    }
  };
  out.accel = await tryOne("accelerometer");
  out.gyro = await tryOne("gyroscope");
  out.mag = await tryOne("magnetometer");
  return out;
}
