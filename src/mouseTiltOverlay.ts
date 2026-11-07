import type { PlayAreaRect } from "./mouseTiltMapping";

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
  private armed = false;
  private active = false;
  private normX = 0;
  private normY = 0;

  constructor(private readonly options: MouseTiltOverlayOptions) {
    this.root = document.createElement("div");
    this.root.id = OVERLAY_ID;
    this.root.setAttribute("aria-hidden", "true");
    this.root.style.cssText = [
      "position:fixed",
      "inset:0",
      "pointer-events:none",
      "z-index:5",
      "display:none"
    ].join(";");

    this.centerMark = document.createElement("div");
    this.centerMark.style.cssText = [
      "position:absolute",
      "width:14px",
      "height:14px",
      "margin:-7px 0 0 -7px",
      "border:2px solid rgba(201,162,39,0.85)",
      "border-radius:50%",
      "background:rgba(26,18,10,0.35)",
      "box-shadow:0 0 0 1px rgba(0,0,0,0.4)"
    ].join(";");

    this.vector = document.createElement("div");
    this.vector.style.cssText = [
      "position:absolute",
      "height:3px",
      "transform-origin:0 50%",
      "background:linear-gradient(90deg,rgba(201,162,39,0.9),rgba(245,230,150,0.75))",
      "border-radius:2px",
      "opacity:0.9"
    ].join(";");

    this.strengthBar = document.createElement("div");
    this.strengthBar.style.cssText = [
      "position:absolute",
      "width:4px",
      "height:48px",
      "border-radius:2px",
      "background:rgba(0,0,0,0.35)",
      "overflow:hidden"
    ].join(";");
    const fill = document.createElement("div");
    fill.className = "mouse-tilt-strength-fill";
    fill.style.cssText =
      "position:absolute;bottom:0;left:0;right:0;height:0%;background:rgba(201,162,39,0.92);transition:height 60ms linear";
    this.strengthBar.appendChild(fill);

    this.root.append(this.centerMark, this.vector, this.strengthBar);
    document.body.appendChild(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  setVisible(show: boolean): void {
    this.root.style.display = show ? "block" : "none";
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
    this.vector.style.opacity = active && mag > 0.07 ? "0.92" : "0.35";

    const fill = this.strengthBar.querySelector(".mouse-tilt-strength-fill") as HTMLDivElement | null;
    this.strengthBar.style.left = `${area.left + 8}px`;
    this.strengthBar.style.top = `${area.top + area.height / 2 - 24}px`;
    if (fill) fill.style.height = `${Math.round(mag * 100)}%`;
  }
}

export function createMouseHelpPanel(): {
  root: HTMLDivElement;
  toggleBtn: HTMLButtonElement;
  panel: HTMLDivElement;
} {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:flex-start;gap:6px";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.id = "btn-mouse-help";
  toggleBtn.textContent = "Nápověda: myš";
  toggleBtn.style.cssText =
    "padding:8px 12px;border-radius:10px;border:1px solid #c9a227;background:#3d2918;color:#f5e6d3;font-size:0.85rem;cursor:pointer";

  const panel = document.createElement("div");
  panel.id = "tilt-maze-mouse-help";
  panel.hidden = true;
  panel.style.cssText = [
    "max-width:min(320px,92vw)",
    "padding:10px 12px",
    "border-radius:10px",
    "border:1px solid rgba(201,162,39,0.55)",
    "background:rgba(35,22,12,0.94)",
    "color:#e8dcc8",
    "font-size:0.82rem",
    "line-height:1.45",
    "text-align:left",
    "box-shadow:0 2px 10px rgba(0,0,0,0.35)"
  ].join(";");
  panel.innerHTML = `
    <p style="margin:0 0 8px"><strong>Ovládání myší (plocha)</strong></p>
    <ul style="margin:0;padding-left:1.1rem">
      <li>Stiskněte <strong>Myš</strong> nebo klávesu <strong>M</strong> pro zapnutí / vypnutí.</li>
      <li><strong>Střed kruhu</strong> na herní ploše = rovina (žádný sklon).</li>
      <li><strong>Směr od středu</strong> = směr, kam se „kutáčí“ deska; <strong>vzdálenost</strong> = síla.</li>
      <li>Držte kurzor <strong>uvnitř tmavé herní plochy</strong> (ne v pruhu tlačítek).</li>
      <li><strong>Zastavení:</strong> vypněte „Myš“, stiskněte <strong>Escape</strong>, přepněte okno, nebo vyjeďte kurzorem mimo plánku.</li>
    </ul>
    <p style="margin:8px 0 0;font-size:0.78rem;opacity:0.85">Šipky, WASD a naklonění telefonu zůstávají; při senzoru má telefon přednost před myší.</p>
  `;

  toggleBtn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });

  wrap.append(toggleBtn, panel);
  return { root: wrap, toggleBtn, panel };
}
