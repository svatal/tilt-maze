import Phaser from "phaser";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../constants";
import { LEVELS } from "../levels";
import { querySensorPermissions } from "../sensorMonitor";
import { requestIOSMotionPermission } from "../tilt";
import { attachBuildInfoLabel } from "../ui/attachBuildInfo";
import { levelMenuGroupId, menuLevelGroups } from "../menuLevelGroups";
import { HELP_SECTIONS } from "../ui/sensorHelpContent";
import sharedUi from "../ui/sharedUi.module.css";
import menuStyles from "./menuOverlay.module.css";

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

  private levelButtonClass(index: number): string {
    const g = levelMenuGroupId(LEVELS[index]);
    return g === "traps" ? sharedUi.btnLevelTraps : sharedUi.btnLevelWalls;
  }

  private buildDomMenu(): void {
    const root = document.createElement("div");
    root.id = "tilt-maze-menu";
    root.dataset.testid = "main-menu";
    root.className = menuStyles.menuRoot;

    const header = document.createElement("header");
    header.className = menuStyles.menuHeader;
    header.innerHTML = `
      <h1 class="${menuStyles.menuHeaderTitle}">Sklopený labyrint</h1>
      <p class="${menuStyles.menuHeaderLead}">
        Klepněte na úroveň a začněte hrát. Všechny úrovně jsou pro testování odemčené.
      </p>
    `;

    const main = document.createElement("div");
    main.className = menuStyles.menuMain;

    const levelLabel = document.createElement("div");
    levelLabel.id = "tilt-maze-levels-label";
    levelLabel.className = menuStyles.levelsLabel;
    levelLabel.textContent = "Úrovně";

    const levelScroll = document.createElement("div");
    levelScroll.id = "tilt-maze-level-list";
    levelScroll.setAttribute("aria-label", "Úrovně");
    levelScroll.className = menuStyles.menuLevelScroll;

    const groups = menuLevelGroups(LEVELS);
    for (const group of groups) {
      const section = document.createElement("section");
      section.className = menuStyles.levelGroupSection;
      section.setAttribute("aria-label", group.title);

      const groupTitle = document.createElement("h3");
      groupTitle.className = menuStyles.levelGroupTitle;
      groupTitle.textContent = group.title;

      const grid = document.createElement("div");
      grid.className = menuStyles.levelGroupGrid;

      for (const i of group.indices) {
        const lvl = LEVELS[i];
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.levelIndex = String(i);
        b.dataset.levelGroup = group.id;
        b.className = this.levelButtonClass(i);
        b.innerHTML = `<span class="${menuStyles.levelCardLabel}" data-testid="level-card-label" lang="cs">${i + 1}. ${lvl.name}</span>`;
        b.addEventListener("click", () => void this.startLevel(i));
        grid.append(b);
      }

      section.append(groupTitle, grid);
      levelScroll.append(section);
    }

    const actions = document.createElement("div");
    actions.className = menuStyles.menuActions;

    const btnHelp = document.createElement("button");
    btnHelp.type = "button";
    btnHelp.id = "menu-btn-help";
    btnHelp.textContent = "Nápověda ovládání a senzorů";
    btnHelp.className = sharedUi.btnSecondary;
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
    layer.className = `${menuStyles.panelOverlay} ${menuStyles.helpLayer}`;
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", "Nápověda");

    const card = document.createElement("div");
    card.className = menuStyles.helpCard;

    const sections = HELP_SECTIONS.map(
      (s) => `
      <section class="${menuStyles.helpSection}" aria-labelledby="help-${s.id}">
        <h2 id="help-${s.id}">${s.title}</h2>
        <div class="${menuStyles.helpSectionBody}">${s.bodyHtml}</div>
      </section>
    `
    ).join("");

    card.innerHTML = `
      <h2 class="${menuStyles.helpCardTitle}">Nápověda</h2>
      <div class="${menuStyles.helpScroll}" data-testid="help-scroll">
        ${sections}
        <div id="sensor-perm-status" class="${menuStyles.helpPermStatus}" aria-live="polite"></div>
      </div>
      <div class="${menuStyles.helpActions}">
        <button type="button" id="help-btn-perms" class="${sharedUi.btnSecondary}">Zkontrolovat oprávnění senzorů</button>
        <button type="button" id="help-btn-ios" class="${sharedUi.btnSecondary}">Požádat o přístup (iOS)</button>
        <button type="button" id="help-btn-close" class="${sharedUi.btnPrimary}">Zavřít</button>
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
    closeBtn.focus({ preventScroll: true });
  }

  private closeHelp(): void {
    this.helpLayer?.remove();
    this.helpLayer = null;
  }
}