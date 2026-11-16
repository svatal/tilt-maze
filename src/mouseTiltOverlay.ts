import type { PlayAreaRect } from "./mouseTiltMapping";
import styles from "./mouseTiltOverlay.module.css";

const OVERLAY_ID = "tilt-maze-mouse-overlay";

export type MouseTiltOverlayOptions = {
  getPlayArea: () => PlayAreaRect;
};

/**
 * Nenápadná vizualizace středu, směru a síly naklonění myší (jen při aktivaci).
 */
export class MouseTiltOverlay {
  private readonly root: HTMLDivElement;
  private readonly centerMark: HTMLDivElement;
  private readonly vector: HTMLDivElement;
  private readonly strengthBar: HTMLDivElement;
  private readonly strengthFill: HTMLDivElement;
  private armed = false;
  private active = false;
  private normX = 0;
  private normY = 0;

  constructor(private readonly options: MouseTiltOverlayOptions) {
    this.root = document.createElement("div");
    this.root.id = OVERLAY_ID;
    this.root.setAttribute("aria-hidden", "true");
    this.root.className = styles.root;
    this.root.hidden = true;

    this.centerMark = document.createElement("div");
    this.centerMark.className = styles.centerMark;

    this.vector = document.createElement("div");
    this.vector.className = styles.vector;

    this.strengthBar = document.createElement("div");
    this.strengthBar.className = styles.strengthBar;
    this.strengthFill = document.createElement("div");
    this.strengthFill.className = styles.strengthFill;
    this.strengthBar.appendChild(this.strengthFill);

    this.root.append(this.centerMark, this.vector, this.strengthBar);
    document.body.appendChild(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  setVisible(show: boolean): void {
    this.root.hidden = !show;
  }

  setArmed(armed: boolean): void {
    this.armed = armed;
    this.setVisible(armed);
    if (!armed) this.updateVisual(0, 0, false);
  }

  updateTilt(normX: number, normY: number, active: boolean): void {
    this.normX = normX;
    this.normY = normY;
    this.active = active;
    this.updateVisual(normX, normY, active);
  }

  layout(): void {
    if (!this.armed) return;
    this.updateVisual(this.normX, this.normY, this.active);
  }

  private updateVisual(nx: number, ny: number, active: boolean): void {
    const area = this.options.getPlayArea();
    const cx = area.left + area.width / 2;
    const cy = area.top + area.height / 2;
    this.centerMark.style.left = `${cx}px`;
    this.centerMark.style.top = `${cy}px`;

    const mag = Math.min(1, Math.hypot(nx, ny));
    const angle = Math.atan2(ny, nx);
    const maxLen = Math.min(area.width, area.height) * 0.38;
    const len = active ? Math.max(8, mag * maxLen) : 0;
    this.vector.style.left = `${cx}px`;
    this.vector.style.top = `${cy}px`;
    this.vector.style.width = `${len}px`;
    this.vector.style.transform = `rotate(${angle}rad)`;
    this.vector.classList.toggle(styles.vectorActive, active && mag > 0.07);

    this.strengthBar.style.left = `${area.left + 8}px`;
    this.strengthBar.style.top = `${area.top + area.height / 2 - 24}px`;
    this.strengthFill.style.height = `${Math.round(mag * 100)}%`;
  }
}