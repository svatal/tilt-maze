import Phaser from "phaser";
import { BALL_RADIUS, DESIGN_HEIGHT, DESIGN_WIDTH } from "../constants";
import { LEVELS, type LevelDef } from "../levels";
import { TiltController } from "../tilt";
import {
  hasShownDesktopSensorHint,
  hasValidSensorRecovery,
  markUserDismissedSensorBanner,
  markValidSensorRecovery,
  recordSensorBannerShown,
  shouldShowSensorBannerKind,
  type StorageLike
} from "../sensorBannerSession";
import {
  ballCenterDistance,
  ballCenterTriggersHoleSink,
  ballInHoleSlopeAnnulus,
  composeBoardAndHoleTilts,
  holeLocalTilt,
  type HoleDef
} from "../holeSlope";
import { playAreaFromCanvasBounds, type PlayAreaRect } from "../mouseTiltMapping";
import { MouseTiltOverlay } from "../mouseTiltOverlay";
import { attachBuildInfoLabel } from "../ui/attachBuildInfo";
import {
  DESKTOP_SENSOR_HINT_TEXT,
  SENSOR_DISMISS_BUTTON_LABEL,
  SENSOR_WARNING_INNER_HTML
} from "../ui/sensorHelpContent";
import type { GameSceneStartData } from "./MenuScene";

const WALL_FRICTION = 0.08;
/** Restituce kuličky – u kolize se zdí rozhoduje Math.max(kulička, zeď). */
const BALL_RESTITUTION = 0.5;
const FORCE_MULT = 0.00085;
const MAX_SPEED = 7;

/** Čas sesazení v cíli před výhrou (Phaser tween). */
const GOAL_SETTLE_MS = 460;
/** Krátký propad v pasti. */
const TRAP_SINK_MS = 280;
const DESKTOP_HINT_MS = 5500;

const SENSOR_HTML = `${SENSOR_WARNING_INNER_HTML}
  <button type="button" id="sensor-dismiss" style="padding:10px 20px;border-radius:10px;border:1px solid #c9a227;background:#3d2918;color:#f5e6d3;cursor:pointer;font-size:0.9rem;min-height:44px">${SENSOR_DISMISS_BUTTON_LABEL}</button>
`;

export class GameScene extends Phaser.Scene {
  private tilt!: TiltController;
  private ball!: Phaser.Physics.Matter.Image;
  private levelIndex = 0;
  private elapsedMs = 0;
  private running = false;
  private wallBodies: MatterJS.BodyType[] = [];
  private decorative: Phaser.GameObjects.Graphics[] = [];
  private trapBodies: MatterJS.BodyType[] = [];
  private hud!: HTMLElement;
  private timerEl!: HTMLElement;
  private levelEl!: HTMLElement;
  private winLayer!: HTMLElement;
  private uiRoot!: HTMLElement;
  private sensorBanner: HTMLElement | null = null;
  private removeBuildInfo: (() => void) | null = null;
  private initialLevelIndex = 0;
  /** Zruší pozdní beginPlay po opuštění scény. */
  private playSession = 0;
  private desktopHintTimer: ReturnType<typeof setTimeout> | null = null;
  private mouseOverlay: MouseTiltOverlay | null = null;
  private btnMouseToggle: HTMLButtonElement | null = null;
  private lastVibrateAt = 0;
  private sensorStorage: StorageLike = typeof sessionStorage !== "undefined" ? sessionStorage : { getItem: () => null, setItem: () => undefined };
  private goalSettling = false;
  private trapSinking = false;
  private terminalTween: Phaser.Tweens.Tween | null = null;
  private goalHole: HoleDef | null = null;
  /** E2E: vzdálenost středu v okamžiku spuštění trigger animace. */
  private e2eLastTriggerDist: number | null = null;
  private lastHudBandPx = 0;
  constructor() {
    super({ key: "GameScene" });
  }

  init(data?: GameSceneStartData): void {
    const payload = (data ?? this.sys.settings.data) as GameSceneStartData | undefined;
    if (payload?.levelIndex != null) {
      this.initialLevelIndex = payload.levelIndex;
    }
    this.running = false;
    this.events.off(Phaser.Scenes.Events.WAKE, this.onSceneWake, this);
    this.events.on(Phaser.Scenes.Events.WAKE, this.onSceneWake, this);
  }

  private sceneCreated = false;

  /** Po návratu z menu (sleep/run) znovu načte úroveň — create se nevolá. */
  private readonly onSceneWake = (_sys: unknown, data?: GameSceneStartData): void => {
    if (!this.sceneCreated) return;
    const payload = data ?? (this.sys.settings.data as GameSceneStartData | undefined);
    if (payload?.levelIndex == null) return;
    this.initialLevelIndex = payload.levelIndex;
    if (!this.hud || !document.getElementById("tilt-maze-ui")) {
      this.buildHud();
    }
    this.loadLevel(payload.levelIndex);
    this.showPlayHud();
    void this.finishBeginPlay(this.playSession);
  };

  create(data?: GameSceneStartData): void {
    const payload = (data ?? this.sys.settings.data) as GameSceneStartData | undefined;
    if (payload?.levelIndex != null) this.initialLevelIndex = payload.levelIndex;
    const qs = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
    this.sensorStorage = typeof sessionStorage !== "undefined" ? sessionStorage : { getItem: () => null, setItem: () => undefined };
    this.ensureTextures();
    this.matter.world.setBounds(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 32, true, true, true, true);
    this.matter.world.setGravity(0, 0);

    if (qs.get("matterDebug") === "1" || import.meta.env.VITE_MATTER_DEBUG === "true") {
      this.matter.world.createDebugGraphic();
    }

    this.buildBackground();
    this.buildHud();

    this.mouseOverlay = new MouseTiltOverlay({ getPlayArea: () => this.getPlayArea() });

    this.tilt = new TiltController({
      getPlayArea: () => this.getPlayArea(),
      isUiTarget: (el) => this.isOverlayUiTarget(el),
      onMouseArmedChange: (armed) => this.onMouseArmedChanged(armed),
      onMouseTiltVisual: (nx, ny, active) => this.mouseOverlay?.updateTilt(nx, ny, active),
      onSensorDesktopHint: () => this.maybeShowDesktopSensorHint(),
      onSensorDataStale: () => this.maybeShowFullSensorWarning(),
      onSensorDataRecovered: () => this.onSensorValidDataRecovered()
    });

    this.scale.off("resize", this.layoutHud, this);
    this.scale.on("resize", this.layoutHud, this);
    this.layoutHud(this.scale.gameSize);

    this.matter.world.on("collisionstart", this.onCollisionStart, this);

    this.game.events.on("debug-complete-level", this.debugWinLevel, this);

    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    this.loadLevel(this.initialLevelIndex);
    this.showPlayHud();

    if (qs.get("e2e") === "1") {
      const w = window as unknown as {
        __e2ePlaceBall?: (x: number, y: number) => void;
        __e2eHoleState?: () => {
          goalSettling: boolean;
          trapSinking: boolean;
          ballStatic: boolean;
          lastTriggerDist: number | null;
        };
        __e2eTickHoles?: () => void;
        __e2eHoleLocalMag?: (trapIndex?: number) => number;
      };
      w.__e2ePlaceBall = (x: number, y: number) => this.e2ePlaceBall(x, y);
      w.__e2eHoleState = () => ({
        goalSettling: this.goalSettling,
        trapSinking: this.trapSinking,
        ballStatic: Boolean((this.ball?.body as MatterJS.BodyType | undefined)?.isStatic),
        lastTriggerDist: this.e2eLastTriggerDist
      });
      w.__e2eTickHoles = () => this.e2eTickHoleChecks();
      w.__e2eHoleLocalMag = (trapIndex = 0) => {
        const tr = LEVELS[this.levelIndex].traps[trapIndex];
        if (!tr || !this.ball?.body) return 0;
        const bb = this.ball.body as MatterJS.BodyType;
        const h: HoleDef = { cx: tr.x, cy: tr.y, r: tr.r };
        const t = holeLocalTilt(bb.position.x, bb.position.y, h);
        return Math.hypot(t.ax, t.ay);
      };
    }

    this.removeBuildInfo = attachBuildInfoLabel();

    void this.finishBeginPlay(this.playSession);
    this.sceneCreated = true;
  }

  private readonly onShutdown = (): void => {
    this.playSession++;
    if (this.desktopHintTimer) {
      clearTimeout(this.desktopHintTimer);
      this.desktopHintTimer = null;
    }
    this.tilt?.setMouseArmed(false);
    this.mouseOverlay?.destroy();
    this.mouseOverlay = null;
    this.removeSensorBanner();
    this.clearDecor();
    this.uiRoot?.remove();
    this.removeBuildInfo?.();
    this.removeBuildInfo = null;
    this.running = false;
    this.scale.off("resize", this.layoutHud, this);
    this.tilt?.destroy();
    this.game.events.off("debug-complete-level", this.debugWinLevel, this);
    if (this.matter?.world) {
      this.matter.world.off("collisionstart", this.onCollisionStart, this);
    }
    const w = window as unknown as { __tiltMazeScene?: GameScene };
    if (w.__tiltMazeScene === this) {
      delete w.__tiltMazeScene;
    }
  };

  /** Okamžitě zobrazí HUD a spustí herní smyčku (nezávisle na senzorech). */
  private showPlayHud(): void {
    this.hud.style.display = "flex";
    this.running = true;
    if (new URLSearchParams(typeof location !== "undefined" ? location.search : "").get("e2e") === "1") {
      (window as unknown as { __tiltMazeScene?: GameScene }).__tiltMazeScene = this;
    }
    this.elapsedMs = 0;
    this.layoutHud(this.scale.gameSize);
    this.game.scale.refresh();
    this.layoutHud(this.scale.gameSize);
  }

  /** E2E: přesun kuličky a reset rychlosti. */
  e2ePlaceBall(x: number, y: number): void {
    if (!this.ball?.body) return;
    const bb = this.ball.body as MatterJS.BodyType;
    this.cancelTerminalMotion();
    this.matter.body.setStatic(bb, false);
    this.matter.body.setPosition(bb, { x, y });
    this.matter.body.setVelocity(bb, { x: 0, y: 0 });
    this.e2eLastTriggerDist = null;
  }

  /** E2E: vyhodnotí trigger zóny bez čekání na další snímek update smyčky. */
  e2eTickHoleChecks(): void {
    if (!this.ball?.body) return;
    const bb = this.ball.body as MatterJS.BodyType;
    this.checkHoleTerminals(bb.position, LEVELS[this.levelIndex]);
  }

  /** Pro E2E: všechny zdi úrovně ve vnitřním rámu desky */
  verifyWallsFitDesignBoard(): boolean {
    const lvl = LEVELS[this.levelIndex];
    const pad = 2;
    for (const w of lvl.walls) {
      const left = w.cx - w.w / 2;
      const right = w.cx + w.w / 2;
      const top = w.cy - w.h / 2;
      const bottom = w.cy + w.h / 2;
      if (left < pad || right > DESIGN_WIDTH - pad || top < pad || bottom > DESIGN_HEIGHT - pad) {
        return false;
      }
    }
    return true;
  }

  update(_time: number, delta: number): void {
    if (!this.running || !this.ball?.body) return;
    this.elapsedMs += delta;

    const bb = this.ball.body as MatterJS.BodyType;
    const pos = bb.position;
    const lvl = LEVELS[this.levelIndex];

    if (!this.goalSettling && !this.trapSinking) {
      if (this.tilt.isMouseArmed()) {
        this.tilt.monitor.markManualInputOverride(performance.now());
      }
      const t = this.tilt.update(delta, 1);
      const trapBowls: HoleDef[] = lvl.traps
        .map((tr) => ({ cx: tr.x, cy: tr.y, r: tr.r }))
        .filter((h) => ballInHoleSlopeAnnulus(pos.x, pos.y, h));
      const composed = composeBoardAndHoleTilts(t.ax, t.ay, pos.x, pos.y, this.goalHole, trapBowls);
      const fx = composed.ax * FORCE_MULT;
      const fy = composed.ay * FORCE_MULT;
      this.matter.body.applyForce(bb, bb.position, { x: fx, y: fy });

      const v = bb.velocity;
      const sp = Math.hypot(v.x, v.y);
      if (sp > MAX_SPEED) {
        const k = MAX_SPEED / sp;
        this.matter.body.setVelocity(bb, { x: v.x * k, y: v.y * k });
      }

      this.checkHoleTerminals(pos, lvl);
    }

    this.timerEl.textContent = this.formatTime(this.elapsedMs);
  }

  private checkHoleTerminals(pos: { x: number; y: number }, lvl: LevelDef): void {
    const goal: HoleDef = { cx: lvl.goal.x, cy: lvl.goal.y, r: lvl.goal.r };
    if (ballCenterTriggersHoleSink(pos.x, pos.y, goal)) {
      this.beginGoalSettle(goal);
      return;
    }
    for (const tr of lvl.traps) {
      const hole: HoleDef = { cx: tr.x, cy: tr.y, r: tr.r };
      if (ballCenterTriggersHoleSink(pos.x, pos.y, hole)) {
        this.beginTrapSink(hole);
        return;
      }
    }
  }

  private recordE2eTrigger(hole: HoleDef): void {
    if (!this.ball?.body) return;
    const bb = this.ball.body as MatterJS.BodyType;
    const qs = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
    if (qs.get("e2e") !== "1") return;
    this.e2eLastTriggerDist = ballCenterDistance(bb.position.x, bb.position.y, hole);
  }

  private cancelTerminalMotion(): void {
    this.goalSettling = false;
    this.trapSinking = false;
    this.e2eLastTriggerDist = null;
    if (this.terminalTween) {
      this.terminalTween.stop();
      this.terminalTween = null;
    }
    if (this.ball) {
      this.ball.setScale(1);
      this.ball.setAlpha(1);
      const display = BALL_RADIUS * 2;
      this.ball.setDisplaySize(display, display);
    }
    if (this.ball?.body) {
      const bb = this.ball.body as MatterJS.BodyType;
      this.matter.body.setStatic(bb, false);
    }
  }

  private beginGoalSettle(hole: HoleDef): void {
    if (this.goalSettling || this.trapSinking || !this.ball?.body) return;
    this.recordE2eTrigger(hole);
    this.goalSettling = true;
    const bb = this.ball.body as MatterJS.BodyType;
    this.matter.body.setVelocity(bb, { x: bb.velocity.x * 0.35, y: bb.velocity.y * 0.35 });
    this.matter.body.setStatic(bb, true);

    this.terminalTween = this.tweens.add({
      targets: this.ball,
      scaleX: 0.35,
      scaleY: 0.35,
      alpha: 0.25,
      duration: GOAL_SETTLE_MS,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.terminalTween = null;
        this.goalSettling = false;
        this.winLevel();
      }
    });
  }

  private beginTrapSink(hole: HoleDef): void {
    if (this.trapSinking || this.goalSettling || !this.ball?.body) return;
    this.recordE2eTrigger(hole);
    this.trapSinking = true;
    const bb = this.ball.body as MatterJS.BodyType;
    this.matter.body.setVelocity(bb, { x: 0, y: 0 });
    this.matter.body.setStatic(bb, true);

    this.terminalTween = this.tweens.add({
      targets: this.ball,
      scaleX: 0.2,
      scaleY: 0.2,
      alpha: 0.1,
      duration: TRAP_SINK_MS,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.terminalTween = null;
        this.trapSinking = false;
        this.restoreBallAfterTrap();
      }
    });

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([15, 40, 15]);
      } catch {
        /* ignore */
      }
    }
  }

  private restoreBallAfterTrap(): void {
    const lvl = LEVELS[this.levelIndex];
    if (!this.ball?.body) return;
    const bb = this.ball.body as MatterJS.BodyType;
    this.ball.setScale(1);
    this.ball.setAlpha(1);
    this.ball.setDisplaySize(BALL_RADIUS * 2, BALL_RADIUS * 2);
    this.matter.body.setStatic(bb, false);
    this.matter.body.setPosition(bb, { x: lvl.start.x, y: lvl.start.y });
    this.matter.body.setVelocity(bb, { x: 0, y: 0 });
  }

  private debugWinLevel = (): void => {
    if (!this.running) return;
    this.winLevel();
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

  private buildHud(): void {
    document.getElementById("tilt-maze-ui")?.remove();
    const root = document.createElement("div");
    root.id = "tilt-maze-ui";
    root.style.cssText = [
      "position:fixed",
      "inset:0",
      "pointer-events:none",
      "font-family:system-ui,Segoe UI,Roboto,sans-serif",
      "z-index:10"
    ].join(";");

    const hud = document.createElement("div");
    hud.style.cssText = [
      "position:absolute",
      "top:0",
      "left:0",
      "right:0",
      "display:none",
      "flex-direction:column",
      "gap:6px",
      "padding:8px 12px",
      "pointer-events:auto",
      "color:#fff",
      "text-shadow:0 1px 2px #000",
      "box-sizing:border-box"
    ].join(";");
    this.hud = hud;

    const titleRow = document.createElement("div");
    titleRow.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;gap:12px;width:100%";

    this.levelEl = document.createElement("div");
    this.levelEl.style.fontWeight = "700";
    this.levelEl.style.flex = "1 1 auto";
    this.levelEl.style.minWidth = "0";
    this.levelEl.style.minHeight = "2.55em";
    this.levelEl.style.lineHeight = "1.22";
    this.timerEl = document.createElement("div");
    this.timerEl.style.flex = "0 0 auto";
    this.timerEl.style.whiteSpace = "nowrap";
    titleRow.append(this.levelEl, this.timerEl);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:100%";

    const mkBtn = (id: string, label: string) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = id;
      b.textContent = label;
      b.style.cssText =
        "padding:8px 12px;border-radius:10px;border:1px solid #c9a227;background:#3d2918;color:#f5e6d3;font-size:0.85rem;cursor:pointer";
      return b;
    };

    const btnMenu = mkBtn("btn-menu", "Menu");
    const btnCal = mkBtn("btn-cal", "Kalibrovat");
    const btnRestart = mkBtn("btn-restart", "Restart");
    const btnMouse = mkBtn("btn-mouse", "Myš");
    btnMouse.setAttribute("aria-pressed", "false");
    btnMouse.title = "Zapnout/vypnout analogové ovládání myší (klávesa M)";
    this.btnMouseToggle = btnMouse;

    actions.append(btnMenu, btnCal, btnRestart, btnMouse);

    hud.append(titleRow, actions);

    this.winLayer = document.createElement("div");
    this.winLayer.style.cssText = [
      "position:absolute",
      "inset:0",
      "display:none",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "background:rgba(10,8,5,0.92)",
      "pointer-events:auto",
      "color:#f5e6d3",
      "text-align:center",
      "padding:24px"
    ].join(";");

    root.append(hud, this.winLayer);
    document.body.appendChild(root);
    this.uiRoot = root;

    btnMenu.addEventListener("click", () => this.returnToMenu());

    btnCal.addEventListener("click", () => {
      this.tilt.calibrate();
    });

    btnRestart.addEventListener("click", () => {
      this.restartLevel();
    });

    btnMouse.addEventListener("click", () => {
      this.tilt.toggleMouseArmed();
    });
  }

  private getPlayArea(): PlayAreaRect {
    const b = this.game.scale.canvasBounds;
    return playAreaFromCanvasBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
  }

  private isOverlayUiTarget(el: EventTarget | null): boolean {
    if (!(el instanceof Node)) return false;
    const ui = document.getElementById("tilt-maze-ui");
    if (ui?.contains(el)) return true;
    if (this.sensorBanner?.contains(el)) return true;
    const menuHelp = document.getElementById("tilt-maze-help");
    if (menuHelp?.contains(el)) return true;
    return false;
  }

  private onMouseArmedChanged(armed: boolean): void {
    this.btnMouseToggle?.setAttribute("aria-pressed", String(armed));
    this.btnMouseToggle?.classList.toggle("mouse-armed-active", armed);
    if (armed) {
      this.btnMouseToggle!.style.outline = "2px solid rgba(201,162,39,0.85)";
    } else {
      this.btnMouseToggle!.style.outline = "";
    }
    this.mouseOverlay?.setArmed(armed);
    this.mouseOverlay?.layout();
  }

  private removeSensorBanner(): void {
    if (this.desktopHintTimer) {
      clearTimeout(this.desktopHintTimer);
      this.desktopHintTimer = null;
    }
    this.sensorBanner?.remove();
    this.sensorBanner = null;
  }

  private onSensorValidDataRecovered(): void {
    markValidSensorRecovery(this.sensorStorage);
    this.removeSensorBanner();
  }

  private maybeShowDesktopSensorHint(): void {
    if (!shouldShowSensorBannerKind(this.sensorStorage, "desktop_hint")) return;
    recordSensorBannerShown(this.sensorStorage, "desktop_hint");

    this.removeSensorBanner();
    const el = document.createElement("div");
    el.id = "tilt-maze-sensor-desktop-hint";
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:18px",
      "transform:translateX(-50%)",
      "max-width:min(360px,calc(100vw - 24px))",
      "background:rgba(35,22,12,0.94)",
      "border:1px solid rgba(201,162,39,0.6)",
      "border-radius:12px",
      "padding:12px 16px",
      "color:#e8dcc8",
      "z-index:2147483647",
      "pointer-events:none",
      "text-align:center",
      "font-size:0.92rem",
      "line-height:1.4",
      "box-shadow:0 3px 12px rgba(0,0,0,0.35)"
    ].join(";");
    el.textContent = DESKTOP_SENSOR_HINT_TEXT;
    document.body.appendChild(el);
    this.sensorBanner = el;
    this.desktopHintTimer = setTimeout(() => {
      el.remove();
      if (this.sensorBanner === el) this.sensorBanner = null;
      this.desktopHintTimer = null;
    }, DESKTOP_HINT_MS);
  }

  private maybeShowFullSensorWarning(): void {
    if (!shouldShowSensorBannerKind(this.sensorStorage, "full_warning")) return;
    if (
      hasShownDesktopSensorHint(this.sensorStorage) &&
      !hasValidSensorRecovery(this.sensorStorage) &&
      !this.tilt.monitor.hadRealSensorValid
    ) {
      return;
    }
    recordSensorBannerShown(this.sensorStorage, "full_warning");

    this.removeSensorBanner();
    const el = document.createElement("div");
    el.id = "tilt-maze-sensor-warn";
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:18px",
      "transform:translateX(-50%)",
      "max-width:min(420px,calc(100vw - 24px))",
      "background:rgba(35,22,12,0.96)",
      "border:1px solid #c9a227",
      "border-radius:12px",
      "padding:14px 16px",
      "color:#f5e6d3",
      "z-index:2147483647",
      "pointer-events:auto",
      "text-align:left",
      "box-shadow:0 4px 16px rgba(0,0,0,0.4)"
    ].join(";");
    el.innerHTML = SENSOR_HTML;
    const dismiss = el.querySelector("#sensor-dismiss") as HTMLButtonElement;
    dismiss.addEventListener("click", () => {
      markUserDismissedSensorBanner(this.sensorStorage);
      el.remove();
      this.sensorBanner = null;
    });
    document.body.appendChild(el);
    this.sensorBanner = el;
  }

  private ensureTextures(): void {
    if (!this.textures.exists("ball_tex")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xfff3a0, 1);
      g.fillCircle(16, 16, 16);
      g.lineStyle(2, 0x8b6914, 1);
      g.strokeCircle(16, 16, 15);
      g.generateTexture("ball_tex", 32, 32);
      g.destroy();
    }
  }

  private layoutHud(_size: Phaser.Structs.Size): void {
    if (!this.hud) return;
    const container = document.getElementById("game-container");
    const hudBandPx =
      this.hud.style.display !== "none"
        ? Math.ceil(this.hud.getBoundingClientRect().height) + 16
        : 96;
    let refreshScale = false;
    if (container) {
      container.style.boxSizing = "border-box";
      if (hudBandPx !== this.lastHudBandPx) {
        this.lastHudBandPx = hudBandPx;
        container.style.paddingTop = "0";
        container.style.marginTop = `${hudBandPx}px`;
        container.style.height = `calc(100% - ${hudBandPx}px)`;
        refreshScale = true;
      }
    }
    const bounds = this.game.scale.canvasBounds;
    this.hud.style.top = "6px";
    this.hud.style.left = `${Math.max(0, Math.round(bounds.left))}px`;
    this.hud.style.width = `${Math.max(0, Math.round(bounds.width))}px`;
    this.hud.style.paddingLeft = "8px";
    this.hud.style.paddingRight = "8px";
    this.mouseOverlay?.layout();
    if (refreshScale) {
      this.game.scale.refresh();
    }
  }

  /** E2E: HUD je celý nad horním okrajem herní desky (nebo v horním letterboxu). */
  verifyHudAboveBoard(): boolean {
    if (!this.hud || this.hud.style.display === "none") return true;
    const hb = this.hud.getBoundingClientRect();
    const canvas = this.game.canvas as HTMLCanvasElement;
    const cb = canvas.getBoundingClientRect();
    return hb.bottom <= cb.top + 2;
  }

  /** E2E: celý canvas (včetně spodního rámu) je v okně bez ořezu. */
  verifyCanvasFitsViewport(): boolean {
    const canvas = this.game.canvas as HTMLCanvasElement;
    const r = canvas.getBoundingClientRect();
    const pad = 1;
    return (
      r.top >= pad &&
      r.left >= -pad &&
      r.bottom <= window.innerHeight + pad &&
      r.right <= window.innerWidth + pad
    );
  }

  private returnToMenu(): void {
    this.playSession++;
    this.running = false;
    this.tilt?.setMouseArmed(false);
    this.cancelTerminalMotion();
    this.removeSensorBanner();
    const container = document.getElementById("game-container");
    if (container) {
      container.style.paddingTop = "";
      container.style.marginTop = "";
      container.style.height = "";
      this.lastHudBandPx = 0;
    }
    for (const el of document.querySelectorAll("#tilt-maze-ui")) {
      el.remove();
    }
    this.scene.sleep("GameScene");
    this.scene.run("MenuScene");
  }

  private async finishBeginPlay(session: number): Promise<void> {
    await this.tilt.startSensors();
    if (session !== this.playSession) return;
    this.tilt.calibrate();

    const el = document.documentElement;
    void (async () => {
      try {
        if (el.requestFullscreen) await el.requestFullscreen();
      } catch {
        /* headless / zamítnuto */
      }
      try {
        const o = screen.orientation;
        if (o && "lock" in o && typeof o.lock === "function") {
          await (o as { lock: (m: string) => Promise<void> }).lock("portrait").catch(() => undefined);
        }
      } catch {
        /* ignore */
      }
    })();
  }

  private clearDecor(): void {
    for (const g of this.decorative) {
      if (g.scene) {
        g.destroy();
      }
    }
    this.decorative = [];
  }

  /** Odstraní všechna tělesa ze světa Matter (i po opětovném startu scény). */
  private purgeMatterBodies(): void {
    if (!this.matter?.world) return;
    const bodies = [...this.matter.world.getAllBodies()];
    for (const b of bodies) {
      this.matter.world.remove(b, true);
    }
  }

  private clearLevelBodies(): void {
    if (this.ball?.scene) {
      this.ball.destroy();
    }
    this.wallBodies = [];
    this.goalHole = null;
    this.trapBodies = [];
  }

  private loadLevel(index: number): void {
    this.levelIndex = Phaser.Math.Clamp(index, 0, LEVELS.length - 1);
    const lvl = LEVELS[this.levelIndex];
    this.cancelTerminalMotion();
    this.clearDecor();
    this.purgeMatterBodies();
    this.clearLevelBodies();

    this.spawnLevel(lvl);
    this.levelEl.textContent = `Úroveň ${this.levelIndex + 1}/${LEVELS.length} — ${lvl.name}`;
    this.timerEl.textContent = this.formatTime(0);
    this.elapsedMs = 0;
    this.winLayer.style.display = "none";
    this.winLayer.innerHTML = "";
    this.layoutHud(this.scale.gameSize);
    requestAnimationFrame(() => {
      this.layoutHud(this.scale.gameSize);
      this.layoutHud(this.scale.gameSize);
    });
  }

  private spawnLevel(lvl: LevelDef): void {
    const gStroke = 0x2d1f12;
    const gFill = 0x8b6914;

    for (const w of lvl.walls) {
      const gr = this.add.graphics();
      gr.fillStyle(gFill, 1);
      gr.lineStyle(2, gStroke, 1);
      gr.fillRoundedRect(w.cx - w.w / 2, w.cy - w.h / 2, w.w, w.h, 6);
      gr.strokeRoundedRect(w.cx - w.w / 2, w.cy - w.h / 2, w.w, w.h, 6);
      this.decorative.push(gr);

      const body = this.matter.add.rectangle(w.cx, w.cy, w.w, w.h, {
        isStatic: true,
        friction: WALL_FRICTION,
        restitution: 0.05,
        chamfer: { radius: 4 },
        label: "wall"
      });
      this.wallBodies.push(body);
    }

    this.matter.add.circle(lvl.goal.x, lvl.goal.y, lvl.goal.r, {
      isStatic: true,
      isSensor: true,
      label: "goal"
    });
    this.goalHole = { cx: lvl.goal.x, cy: lvl.goal.y, r: lvl.goal.r };
    this.drawHole(lvl.goal.x, lvl.goal.y, lvl.goal.r, 0x0d3d0d);

    for (const tr of lvl.traps) {
      const tb = this.matter.add.circle(tr.x, tr.y, tr.r, {
        isStatic: true,
        isSensor: true,
        label: "trap"
      });
      this.trapBodies.push(tb);
      this.drawHole(tr.x, tr.y, tr.r, 0x2a0a0a);
    }

    const ballGo = this.add.image(lvl.start.x, lvl.start.y, "ball_tex");
    this.ball = this.matter.add.gameObject(ballGo, {
      shape: {
        type: "circle",
        x: lvl.start.x,
        y: lvl.start.y,
        radius: BALL_RADIUS
      },
      label: "ball",
      friction: 0.02,
      frictionAir: 0.012,
      restitution: BALL_RESTITUTION
    }) as Phaser.Physics.Matter.Image;
    this.ball.setDisplaySize(BALL_RADIUS * 2, BALL_RADIUS * 2);
  }

  private drawHole(cx: number, cy: number, r: number, inner: number): void {
    const gr = this.add.graphics();
    this.decorative.push(gr);
    gr.fillStyle(0x1a120a, 1);
    gr.fillCircle(cx, cy, r + 2);
    gr.fillStyle(inner, 0.85);
    gr.fillCircle(cx, cy, r - 2);
    gr.lineStyle(2, 0x0a0604, 1);
    gr.strokeCircle(cx, cy, r);
  }

  private onCollisionStart(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    const ballBody = this.ball?.body as MatterJS.BodyType | undefined;
    if (!ballBody) return;

    for (const pair of event.pairs) {
      const a = pair.bodyA as MatterJS.BodyType;
      const b = pair.bodyB as MatterJS.BodyType;
      const involvedBall = a === ballBody || b === ballBody;
      if (!involvedBall) continue;

      const other = a === ballBody ? b : a;
      const ol = String(other.label);

      if (ol === "wall") {
        const now = performance.now();
        if (now - this.lastVibrateAt > 120 && typeof navigator !== "undefined" && navigator.vibrate) {
          this.lastVibrateAt = now;
          try {
            navigator.vibrate(12);
          } catch {
            /* ignore */
          }
        }
      }

    }
  }

  private restartLevel(): void {
    this.running = true;
    this.cancelTerminalMotion();
    const lvl = LEVELS[this.levelIndex];
    if (this.ball?.body) {
      const bb = this.ball.body as MatterJS.BodyType;
      this.matter.body.setPosition(bb, { x: lvl.start.x, y: lvl.start.y });
      this.matter.body.setVelocity(bb, { x: 0, y: 0 });
    }
    this.elapsedMs = 0;
    this.winLayer.style.display = "none";
    this.winLayer.innerHTML = "";
  }

  private winLevel(): void {
    this.cancelTerminalMotion();
    this.running = false;
    const next = this.levelIndex + 1;
    const finishedAll = next >= LEVELS.length;
    this.winLayer.innerHTML = `
      <h2 style="margin:0 0 12px;font-size:1.4rem">Výhra!</h2>
      <p style="margin:0 0 8px">Čas: <strong>${this.formatTime(this.elapsedMs)}</strong></p>
      <p style="margin:0 0 20px">${finishedAll ? "Gratulujeme, zvládli jste všechny úrovně!" : "Připravte se na další úroveň."}</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">
        <button id="btn-next" type="button" style="padding:12px 24px;font-size:1rem;border-radius:12px;border:none;background:#c9a227;color:#1a120a;font-weight:700;cursor:pointer;min-height:44px">
          ${finishedAll ? "Hrát znovu od začátku" : "Další úroveň"}
        </button>
        <button id="btn-win-menu" type="button" style="padding:12px 24px;font-size:1rem;border-radius:12px;border:1px solid #c9a227;background:#3d2918;color:#f5e6d3;font-weight:600;cursor:pointer;min-height:44px">Menu</button>
      </div>
    `;
    this.winLayer.style.display = "flex";
    const btn = this.winLayer.querySelector("#btn-next") as HTMLButtonElement;
    btn.addEventListener(
      "click",
      () => {
        if (finishedAll) this.loadLevel(0);
        else this.loadLevel(next);
        this.running = true;
      },
      { once: true }
    );
    this.winLayer.querySelector("#btn-win-menu")?.addEventListener(
      "click",
      () => {
        this.returnToMenu();
      },
      { once: true }
    );
  }

  private formatTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
  }
}
