import Phaser from "phaser";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../constants";
import { LEVELS } from "../levels";
import { querySensorPermissions } from "../sensorMonitor";
import { requestIOSMotionPermission } from "../tilt";
import { attachBuildInfoLabel } from "../ui/attachBuildInfo";
import {
  BTN_LEVEL,
  BTN_LEVEL_SELECTED,
  BTN_PRIMARY,
  BTN_SECONDARY,
  PANEL_OVERLAY,
  UI_FONT_FAMILY
} from "../ui/domTheme";
import { HELP_SECTIONS } from "../ui/sensorHelpContent";

export type GameSceneStartData = {
  levelIndex: number;
  /** Senzory se spustí v GameScene hned po přechodu ( řetězec po klepnutí uživatele ) */
  startPlay: boolean;
};

export class MenuScene extends Phaser.Scene {
  private rootEl: HTMLElement | null = null;
  private helpLayer: HTMLElement | null = null;
  private selectedIndex = 0;
  private levelButtons: HTMLButtonElement[] = [];
  private removeBuildInfo: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    super({ key: "MenuScene" });
  }

  create(): void {
    const qs = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
    if (qs.get("e2e") === "1" && qs.get("skipMenu") === "1") {
      this.scene.start("GameScene", { levelIndex: 0, startPlay: true } satisfies GameSceneStartData);
      return;
    }

    this.buildBackground();
    this.removeBuildInfo = attachBuildInfoLabel();
    this.buildDomMenu();
    this.scale.on("resize", this.layoutMenu, this);
    this.layoutMenu();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layoutMenu, this);
      this.detachKeyboard();
      this.helpLayer?.remove();
      this.helpLayer = null;
      this.rootEl?.remove();
      this.rootEl = null;
      this.removeBuildInfo?.();
      this.removeBuildInfo = null;
      this.levelButtons = [];
    });
  }

  private layoutMenu = (): void => {
    if (!this.rootEl) return;
    const b = this.game.scale.canvasBounds;
    const left = Math.round(b.left);
    const top = Math.round(b.top);
    const w = Math.max(1, Math.round(b.width));
    const h = Math.max(1, Math.round(b.height));
    this.rootEl.style.left = `${left}px`;
    this.rootEl.style.top = `${top}px`;
    this.rootEl.style.width = `${w}px`;
    this.rootEl.style.height = `${h}px`;
  };

  private buildBackground(): void {
    const g = this.add.graphics();
    const wood1 = 0x5c3d21;
    const wood2 = 0x4a3319;
    g.fillGradientStyle(wood1, wood1, wood2, wood2, 1);
    g.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    g.lineStyle(3, 0x2d1f12, 1);
    g.strokeRect(2, 2, DESIGN_WIDTH - 4, DESIGN_HEIGHT - 4);
  }

  private buildDomMenu(): void {
    const root = document.createElement("div");
    root.id = "tilt-maze-menu";
    root.dataset.testid = "main-menu";
    root.style.cssText = [
      "position:fixed",
      "z-index:20",
      "pointer-events:auto",
      `font-family:${UI_FONT_FAMILY}`,
      "color:#f5e6d3",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "box-sizing:border-box",
      "padding-top:max(12px,env(safe-area-inset-top))",
      "padding-bottom:max(12px,env(safe-area-inset-bottom))",
      "padding-left:max(14px,env(safe-area-inset-left))",
      "padding-right:max(14px,env(safe-area-inset-right))",
      "overflow:hidden",
      "overflow-x:hidden"
    ].join(";");

    const header = document.createElement("header");
    header.style.cssText = "text-align:center;flex-shrink:0;margin-bottom:12px;width:100%;box-sizing:border-box";
    header.innerHTML = `
      <h1 style="margin:0 0 6px;font-size:clamp(1.35rem,4vw,1.75rem);font-weight:700">Sklopený labyrint</h1>
      <p style="margin:0;font-size:0.9rem;line-height:1.4;opacity:0.88;max-width:520px;margin-left:auto;margin-right:auto">
        Vyberte úroveň a začněte hrát. Všechny úrovně jsou pro testování odemčené.
      </p>
    `;

    const main = document.createElement("div");
    main.style.cssText = [
      "flex:1",
      "min-height:0",
      "display:flex",
      "flex-direction:column",
      "gap:12px",
      "width:100%",
      "box-sizing:border-box"
    ].join(";");

    const levelLabel = document.createElement("div");
    levelLabel.id = "tilt-maze-levels-label";
    levelLabel.textContent = "Úrovně";
    levelLabel.style.cssText = "font-weight:700;font-size:0.95rem;width:100%;box-sizing:border-box";

    const levelScroll = document.createElement("div");
    levelScroll.id = "tilt-maze-level-list";
    levelScroll.setAttribute("role", "listbox");
    levelScroll.setAttribute("aria-label", "Výběr úrovně");
    levelScroll.style.cssText = [
      "overflow-y:auto",
      "flex:0 1 auto",
      "max-height:min(38vh,320px)",
      "display:grid",
      "grid-template-columns:repeat(2,minmax(0,1fr))",
      "grid-auto-rows:min-content",
      "align-content:start",
      "align-items:start",
      "justify-items:stretch",
      "gap:8px",
      "padding:0",
      "width:100%",
      "max-width:100%",
      "box-sizing:border-box",
      "overflow-x:hidden",
      "-webkit-overflow-scrolling:touch"
    ].join(";");

    this.levelButtons = LEVELS.map((lvl, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "option");
      b.dataset.levelIndex = String(i);
      b.innerHTML = `<span style="font-weight:700;display:block">${i + 1}. ${lvl.name}</span>`;
      b.style.cssText = i === 0 ? BTN_LEVEL_SELECTED : BTN_LEVEL;
      b.addEventListener("click", () => this.setSelectedLevel(i));
      levelScroll.append(b);
      return b;
    });

    const actions = document.createElement("div");
    actions.style.cssText =
      "display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center;flex-shrink:0;padding-top:4px";

    const btnPlay = document.createElement("button");
    btnPlay.type = "button";
    btnPlay.id = "menu-btn-play";
    btnPlay.textContent = "Hrát vybranou úroveň";
    btnPlay.style.cssText = BTN_PRIMARY;
    btnPlay.addEventListener("click", () => void this.onPlayClick());

    const btnHelp = document.createElement("button");
    btnHelp.type = "button";
    btnHelp.id = "menu-btn-help";
    btnHelp.textContent = "Nápověda ovládání a senzorů";
    btnHelp.style.cssText = BTN_SECONDARY;
    btnHelp.addEventListener("click", () => this.openHelp());

    actions.append(btnPlay, btnHelp);

    const hint = document.createElement("p");
    hint.style.cssText =
      "margin:0;font-size:0.75rem;opacity:0.75;text-align:center;flex-shrink:0;width:100%;box-sizing:border-box";
    hint.textContent = "Šipky / Tab: výběr úrovně · Enter: hrát · H: nápověda";

    main.append(levelLabel, levelScroll, actions);
    root.append(header, main, hint);
    document.body.appendChild(root);
    this.rootEl = root;

    this.attachKeyboard();
    this.updateLevelButtonStyles();
  }

  private setSelectedLevel(index: number): void {
    this.selectedIndex = Phaser.Math.Clamp(index, 0, LEVELS.length - 1);
    this.updateLevelButtonStyles();
    const btn = this.levelButtons[this.selectedIndex];
    btn?.focus({ preventScroll: true });
    btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  private updateLevelButtonStyles(): void {
    this.levelButtons.forEach((b, i) => {
      b.style.cssText = i === this.selectedIndex ? BTN_LEVEL_SELECTED : BTN_LEVEL;
      b.setAttribute("aria-selected", i === this.selectedIndex ? "true" : "false");
    });
  }

  private attachKeyboard(): void {
    this.detachKeyboard();
    const cols = () => Math.max(1, Math.floor((this.levelButtons[0]?.parentElement?.clientWidth ?? 300) / 148));
    this.keyHandler = (e: KeyboardEvent) => {
      if (this.helpLayer) {
        if (e.key === "Escape") {
          e.preventDefault();
          this.closeHelp();
        }
        return;
      }
      const n = LEVELS.length;
      const c = cols();
      if (e.key === "h" || e.key === "H" || e.key === "?") {
        e.preventDefault();
        this.openHelp();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        void this.onPlayClick();
        return;
      }
      let next = this.selectedIndex;
      if (e.key === "ArrowRight") next = Math.min(n - 1, this.selectedIndex + 1);
      else if (e.key === "ArrowLeft") next = Math.max(0, this.selectedIndex - 1);
      else if (e.key === "ArrowDown") next = Math.min(n - 1, this.selectedIndex + c);
      else if (e.key === "ArrowUp") next = Math.max(0, this.selectedIndex - c);
      else return;
      e.preventDefault();
      this.setSelectedLevel(next);
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  private detachKeyboard(): void {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
  }

  private async onPlayClick(): Promise<void> {
    await requestIOSMotionPermission();
    const data: GameSceneStartData = {
      levelIndex: this.selectedIndex,
      startPlay: true
    };
    this.scene.start("GameScene", data);
  }

  private openHelp(): void {
    if (this.helpLayer) return;
    const layer = document.createElement("div");
    layer.id = "tilt-maze-help";
    layer.dataset.testid = "help-overlay";
    layer.style.cssText = `${PANEL_OVERLAY};position:fixed;z-index:30`;
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", "Nápověda");

    const card = document.createElement("div");
    card.style.cssText = [
      "max-width:min(480px,100%)",
      "width:100%",
      "background:rgba(35,22,12,0.96)",
      "border:1px solid #c9a227",
      "border-radius:14px",
      "padding:16px 18px",
      "max-height:min(85vh,640px)",
      "overflow-y:auto",
      "box-shadow:0 4px 20px rgba(0,0,0,0.45)",
      `font-family:${UI_FONT_FAMILY}`
    ].join(";");

    const sections = HELP_SECTIONS.map(
      (s) => `
      <section style="margin-bottom:16px" aria-labelledby="help-${s.id}">
        <h2 id="help-${s.id}" style="margin:0 0 8px;font-size:1.05rem">${s.title}</h2>
        <div style="line-height:1.45;font-size:0.92rem">${s.bodyHtml}</div>
      </section>
    `
    ).join("");

    card.innerHTML = `
      <h2 style="margin:0 0 12px;font-size:1.25rem;text-align:center">Nápověda</h2>
      ${sections}
      <div id="sensor-perm-status" style="margin:12px 0;padding:10px;border-radius:8px;background:rgba(0,0,0,0.25);font-size:0.85rem;line-height:1.4" aria-live="polite"></div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:8px">
        <button type="button" id="help-btn-perms" style="${BTN_SECONDARY}">Zkontrolovat oprávnění senzorů</button>
        <button type="button" id="help-btn-ios" style="${BTN_SECONDARY}">Požádat o přístup (iOS)</button>
        <button type="button" id="help-btn-close" style="${BTN_PRIMARY}">Zavřít</button>
      </div>
    `;

    layer.append(card);
    document.body.appendChild(layer);
    this.helpLayer = layer;

    const statusEl = card.querySelector("#sensor-perm-status") as HTMLElement;
    const setStatus = (msg: string) => {
      statusEl.textContent = msg;
    };

    card.querySelector("#help-btn-close")?.addEventListener("click", () => this.closeHelp());
    layer.addEventListener("click", (ev) => {
      if (ev.target === layer) this.closeHelp();
    });

    card.querySelector("#help-btn-perms")?.addEventListener("click", () => {
      void (async () => {
        const p = await querySensorPermissions();
        const parts = [`Akcelerometr: ${p.accel}`, `Gyroskop: ${p.gyro}`, `Magnetometr: ${p.mag}`];
        setStatus(parts.join(" · "));
      })();
    });

    card.querySelector("#help-btn-ios")?.addEventListener("click", () => {
      void (async () => {
        const ok = await requestIOSMotionPermission();
        setStatus(ok ? "iOS: přístup k pohybu povolen." : "iOS: přístup zamítnut nebo nedostupný (nebo nejste na iOS).");
      })();
    });

    const closeBtn = card.querySelector("#help-btn-close") as HTMLButtonElement;
    closeBtn.focus();
  }

  private closeHelp(): void {
    this.helpLayer?.remove();
    this.helpLayer = null;
  }
}
