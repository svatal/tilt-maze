import Phaser from "phaser";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../constants";
import { LEVELS } from "../levels";
import { querySensorPermissions } from "../sensorMonitor";
import { requestIOSMotionPermission } from "../tilt";
import { attachBuildInfoLabel } from "../ui/attachBuildInfo";
import { levelMenuGroupId, menuLevelGroups } from "../menuLevelGroups";
import {
  BTN_LEVEL_TRAPS,
  BTN_LEVEL_WALLS,
  BTN_PRIMARY,
  BTN_SECONDARY,
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
  private removeBuildInfo: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    super({ key: "MenuScene" });
  }

  create(): void {
    this.buildBackground();
    this.removeBuildInfo = attachBuildInfoLabel();
    this.buildDomMenu();
    this.scale.on("resize", this.layoutMenu, this);
    this.syncMenuOverlayToScale();

    this.events.off(Phaser.Scenes.Events.SLEEP, this.onSceneSleep, this);
    this.events.on(Phaser.Scenes.Events.SLEEP, this.onSceneSleep, this);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onSceneWake, this);
    this.events.on(Phaser.Scenes.Events.WAKE, this.onSceneWake, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.SLEEP, this.onSceneSleep, this);
      this.events.off(Phaser.Scenes.Events.WAKE, this.onSceneWake, this);
      this.scale.off("resize", this.layoutMenu, this);
      this.detachKeyboard();
      this.helpLayer?.remove();
      this.helpLayer = null;
      this.rootEl?.remove();
      this.rootEl = null;
      this.removeBuildInfo?.();
      this.removeBuildInfo = null;
    });
  }

  /** sleep() nevolá SHUTDOWN — DOM menu jinak zůstane jako overlay nad hrou. */
  private readonly onSceneSleep = (): void => {
    this.detachKeyboard();
    if (this.rootEl) this.rootEl.hidden = true;
    if (this.helpLayer) this.helpLayer.hidden = true;
  };

  private readonly onSceneWake = (): void => {
    this.removeBuildInfo?.();
    this.removeBuildInfo = attachBuildInfoLabel();
    if (this.rootEl) this.rootEl.hidden = false;
    if (this.helpLayer) this.helpLayer.hidden = false;
    this.attachKeyboard();
    this.syncMenuOverlayToScale();
  };

  private syncMenuOverlayToScale(): void {
    const container = document.getElementById("game-container");
    if (container) {
      this.scale.setParentSize(container.clientWidth, container.clientHeight);
    }
    this.game.scale.refresh();
    this.layoutMenu();
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

  private levelButtonStyle(index: number): string {
    const g = levelMenuGroupId(LEVELS[index]);
    if (g === "traps") return BTN_LEVEL_TRAPS;
    return BTN_LEVEL_WALLS;
  }

  private buildDomMenu(): void {
    const root = document.createElement("div");
    root.id = "tilt-maze-menu";
    root.dataset.testid = "main-menu";
    root.className = "tilt-maze-menu-root";
    root.style.cssText = [
      "position:fixed",
      "z-index:20",
      "pointer-events:auto",
      `font-family:${UI_FONT_FAMILY}`,
      "color:#f5e6d3",
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
        Klepněte na úroveň a začněte hrát. Všechny úrovně jsou pro testování odemčené.
      </p>
    `;

    const main = document.createElement("div");
    main.className = "tilt-maze-menu-main";
    main.style.cssText = [
      "flex:1 1 0%",
      "min-height:0",
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
    levelScroll.setAttribute("aria-label", "Úrovně");
    levelScroll.className = "tilt-maze-menu-level-scroll";
    levelScroll.style.cssText = [
      "overflow-y:auto",
      "flex:1",
      "min-height:0",
      "gap:12px",
      "padding:0",
      "width:100%",
      "max-width:100%",
      "box-sizing:border-box",
      "overflow-x:hidden",
      "-webkit-overflow-scrolling:touch"
    ].join(";");

    const groups = menuLevelGroups(LEVELS);
    for (const group of groups) {
      const section = document.createElement("section");
      section.className = "tilt-maze-level-group";
      section.setAttribute("aria-label", group.title);
      section.style.cssText = "width:100%;box-sizing:border-box";

      const groupTitle = document.createElement("h3");
      groupTitle.textContent = group.title;
      groupTitle.style.cssText =
        "margin:0 0 6px;font-size:0.82rem;font-weight:600;opacity:0.88;letter-spacing:0.02em;width:100%";

      const grid = document.createElement("div");
      grid.className = "tilt-maze-level-group-grid";

      for (const i of group.indices) {
        const lvl = LEVELS[i];
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.levelIndex = String(i);
        b.dataset.levelGroup = group.id;
        b.innerHTML = `<span class="tilt-maze-level-card-label" lang="cs">${i + 1}. ${lvl.name}</span>`;
        b.style.cssText = this.levelButtonStyle(i);
        b.addEventListener("click", () => void this.startLevel(i));
        grid.append(b);
      }

      section.append(groupTitle, grid);
      levelScroll.append(section);
    }

    const actions = document.createElement("div");
    actions.className = "tilt-maze-menu-actions";
    actions.style.cssText =
      "gap:10px;flex-shrink:0;padding-top:4px;width:100%;box-sizing:border-box";

    const btnHelp = document.createElement("button");
    btnHelp.type = "button";
    btnHelp.id = "menu-btn-help";
    btnHelp.textContent = "Nápověda ovládání a senzorů";
    btnHelp.style.cssText = BTN_SECONDARY;
    btnHelp.addEventListener("click", () => this.openHelp());

    actions.append(btnHelp);

    main.append(levelLabel, levelScroll);
    root.append(header, main, actions);
    document.body.appendChild(root);
    this.rootEl = root;

    this.attachKeyboard();
  }

  private attachKeyboard(): void {
    this.detachKeyboard();
    this.keyHandler = (e: KeyboardEvent) => {
      if (this.helpLayer) {
        if (e.key === "Escape") {
          e.preventDefault();
          this.closeHelp();
        }
        return;
      }
      if (e.key === "h" || e.key === "H" || e.key === "?") {
        e.preventDefault();
        this.openHelp();
      }
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  private detachKeyboard(): void {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
  }

  private async startLevel(index: number): Promise<void> {
    await requestIOSMotionPermission();
    const levelIndex = Phaser.Math.Clamp(index, 0, LEVELS.length - 1);
    const data: GameSceneStartData = {
      levelIndex,
      startPlay: true
    };
    this.scene.sleep("MenuScene");
    this.scene.run("GameScene", data);
  }

  private openHelp(): void {
    if (this.helpLayer) return;
    const layer = document.createElement("div");
    layer.id = "tilt-maze-help";
    layer.dataset.testid = "help-overlay";
    layer.className = "tilt-maze-panel-overlay tilt-maze-help-layer";
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
      <div class="tilt-maze-help-actions">
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