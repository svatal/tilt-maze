/**
 * Naklonění zařízení + klávesnice (fallback) → normalizovaný vektor zrychlení.
 */

const SMOOTH = 0.18;
const KEY_FORCE = 1.2;

export type TiltOutput = { ax: number; ay: number };

export class TiltController {
  private smoothAx = 0;
  private smoothAy = 0;
  private lastGamma: number | null = null;
  private lastBeta: number | null = null;
  /** Záloha z DeviceMotion (accelerationIncludingGravity), když orientace nic nedá */
  private gravX = 0;
  private gravY = 0;
  private calGravX = 0;
  private calGravY = 0;
  private calGamma = 0;
  private calBeta = 0;
  private listening = false;
  private readonly keyTilt = { x: 0, y: 0 };

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    if (this.listening) {
      window.removeEventListener("deviceorientation", this.onOrientation as EventListener);
      window.removeEventListener("devicemotion", this.onMotion as EventListener);
    }
  }

  /** Kalibrace: aktuální poloha = neutrální */
  calibrate(): void {
    if (this.lastGamma !== null) this.calGamma = this.lastGamma;
    if (this.lastBeta !== null) this.calBeta = this.lastBeta;
    this.calGravX = this.gravX;
    this.calGravY = this.gravY;
  }

  /** Spustí sledování gyroskopu (volat po uživatelském gestu). */
  startSensors(): void {
    if (this.listening) return;
    window.addEventListener(
      "deviceorientation",
      this.onOrientation as EventListener,
      { passive: true }
    );
    window.addEventListener("devicemotion", this.onMotion as EventListener, { passive: true });
    this.listening = true;
  }

  /**
   * Na iOS 13+ je potřeba výslovný souhlas.
   * @returns true pokud je možné číst orientaci (nebo to není iOS)
   */
  static async requestPermissionIOS(): Promise<boolean> {
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
        /* motion je volitelný */
      }
    }
    return ok;
  }

  private readonly onOrientation = (e: DeviceOrientationEvent): void => {
    if (e.gamma !== null && !Number.isNaN(e.gamma)) this.lastGamma = e.gamma;
    if (e.beta !== null && !Number.isNaN(e.beta)) this.lastBeta = e.beta;
  };

  private readonly onMotion = (e: DeviceMotionEvent): void => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null) return;
    this.gravX = g.x;
    this.gravY = g.y;
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

    if (this.lastGamma !== null && this.lastBeta !== null) {
      const g = (this.lastGamma - this.calGamma) * (Math.PI / 180);
      const b = (this.lastBeta - this.calBeta) * (Math.PI / 180);
      rawX += Math.sin(g) * 2.2;
      rawY += -Math.sin(b) * 2.2;
    } else {
      const dx = this.gravX - this.calGravX;
      const dy = this.gravY - this.calGravY;
      rawX += dx * 0.35;
      rawY += -dy * 0.35;
    }

    rawX = Math.max(-2.8, Math.min(2.8, rawX));
    rawY = Math.max(-2.8, Math.min(2.8, rawY));

    this.smoothAx += (rawX * forceScale - this.smoothAx) * SMOOTH;
    this.smoothAy += (rawY * forceScale - this.smoothAy) * SMOOTH;

    return { ax: this.smoothAx, ay: this.smoothAy };
  }
}
