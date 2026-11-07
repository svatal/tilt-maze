import {
  clientToNormalizedPointer,
  mapNormalizedPointerToTilt,
  type PlayAreaRect
} from "./mouseTiltMapping";

export type MouseTiltInputOptions = {
  getPlayArea: () => PlayAreaRect;
  /** Element nad kterým nechceme zachytávat (HUD, start, win) */
  isUiTarget: (el: EventTarget | null) => boolean;
  onArmedChange?: (armed: boolean) => void;
  onPointerTiltChange?: (x: number, y: number, nx: number, ny: number, active: boolean) => void;
};

export type MouseTiltSnapshot = {
  armed: boolean;
  windowFocused: boolean;
  pointerInside: boolean;
  rawX: number;
  rawY: number;
  normX: number;
  normY: number;
};

/**
 * Kurzor v herní ploše; aktivace přes tlačítko nebo klávesu M.
 * Blur / opuštění plochy / Escape / vypnutí = neutrál (bez skrytého max tiltu).
 */
export class MouseTiltInput {
  private armed = false;
  private windowFocused = typeof document !== "undefined" ? document.hasFocus() : true;
  private lastClientX = 0;
  private lastClientY = 0;
  private pointerInside = false;
  private rawX = 0;
  private rawY = 0;
  private normX = 0;
  private normY = 0;

  constructor(private readonly options: MouseTiltInputOptions) {
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
    window.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("focus", this.onFocus);
    window.addEventListener("keydown", this.onKeyDown);
  }

  destroy(): void {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("focus", this.onFocus);
    window.removeEventListener("keydown", this.onKeyDown);
    this.zeroTilt();
  }

  snapshot(): MouseTiltSnapshot {
    return {
      armed: this.armed,
      windowFocused: this.windowFocused,
      pointerInside: this.pointerInside,
      rawX: this.rawX,
      rawY: this.rawY,
      normX: this.normX,
      normY: this.normY
    };
  }

  isArmed(): boolean {
    return this.armed;
  }

  setArmed(v: boolean): void {
    if (this.armed === v) return;
    this.armed = v;
    if (!v) this.zeroTilt();
    else this.recomputeFromLastPointer();
    this.options.onArmedChange?.(v);
  }

  toggleArmed(): void {
    this.setArmed(!this.armed);
  }

  getRawTilt(): { x: number; y: number } {
    return { x: this.rawX, y: this.rawY };
  }

  private zeroTilt(): void {
    this.rawX = 0;
    this.rawY = 0;
    this.normX = 0;
    this.normY = 0;
    this.pointerInside = false;
    this.options.onPointerTiltChange?.(0, 0, 0, 0, false);
  }

  private readonly onBlur = (): void => {
    this.windowFocused = false;
    this.setArmed(false);
  };

  private readonly onFocus = (): void => {
    this.windowFocused = true;
  };

  private readonly onPointerLeave = (): void => {
    this.pointerInside = false;
    this.rawX = 0;
    this.rawY = 0;
    this.normX = 0;
    this.normY = 0;
    this.options.onPointerTiltChange?.(0, 0, 0, 0, false);
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && this.armed) {
      e.preventDefault();
      this.setArmed(false);
    }
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.options.isUiTarget(e.target)) return;
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
    if (!this.armed) {
      if (this.rawX !== 0 || this.rawY !== 0) this.zeroTilt();
      return;
    }
    this.recomputeFromClient(e.clientX, e.clientY);
  };

  private recomputeFromLastPointer(): void {
    this.recomputeFromClient(this.lastClientX, this.lastClientY);
  }

  private recomputeFromClient(clientX: number, clientY: number): void {
    const area = this.options.getPlayArea();
    const norm = clientToNormalizedPointer(clientX, clientY, area);
    this.pointerInside = norm.inside;
    if (!norm.inside) {
      this.rawX = 0;
      this.rawY = 0;
      this.normX = 0;
      this.normY = 0;
      this.options.onPointerTiltChange?.(0, 0, 0, 0, false);
      return;
    }
    const tilt = mapNormalizedPointerToTilt(norm.nx, norm.ny);
    this.rawX = tilt.x;
    this.rawY = tilt.y;
    this.normX = norm.nx;
    this.normY = norm.ny;
    this.options.onPointerTiltChange?.(tilt.x, tilt.y, norm.nx, norm.ny, true);
  }
}
