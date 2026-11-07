import Phaser from "phaser";
import { BUILD_INFO_LABEL } from "../buildInfo.generated";
import { BALL_RADIUS, DESIGN_HEIGHT, DESIGN_WIDTH } from "../constants";
import { LEVELS, type LevelDef } from "../levels";
import { requestIOSMotionPermission, TiltController } from "../tilt";
import {
  markUserDismissedSensorBanner,
  markValidSensorRecovery,
  recordSensorBannerShown,
  shouldShowSensorBannerKind,
  type StorageLike
} from "../sensorBannerSession";
import { playAreaFromCanvasBounds, type PlayAreaRect } from "../mouseTiltMapping";
import { MouseTiltOverlay, createMouseHelpPanel } from "../mouseTiltOverlay";

const WALL_FRICTION = 0.08;
const FORCE_MULT = 0.00085;
const MAX_SPEED = 7;

const DESKTOP_HINT_MS = 5500;

const SENSOR_HTML = `
  <div style="margin-bottom:12px;font-size:1.05rem;font-weight:700">Senzory nepřijímají data</div>
  <p style="margin:0 0 10px;max-width:340px;line-height:1.45;font-size:0.9rem">
    Prohlížeč neposílá údaje o naklonění. Na <strong>Androidu v Brave</strong> zkontrolujte stránkové oprávnění
    <strong>Pohybové senzory</strong> (ikonka zámku v adresním řádku → oprávnění) a že
    <strong>Brave Shields</strong> neblokují senzory. V <strong>Chrome</strong> musí být stránka na <strong>HTTPS</strong>.
    Na iOS povolte přístup v dialogu. Můžete použít tlačítka <strong>Kalibrovat</strong> po položení telefonu rovně.
  </p>
  <button type="button" id="sensor-dismiss" style="padding:10px 20px;border-radius:10px;border:1px solid #c9a227;background:#3d2918;color:#f5e6d3;cursor:pointer;font-size:0.9rem">Rozumím, použiju klávesnici</button>
`;

export class GameScene extends Phaser.Scene {
  private tilt!: TiltController;
  private ball!: Phaser.Physics.Matter.Image;
  private levelIndex = 0;
  private elapsedMs = 0;
  private running = false;
  private wallBodies: MatterJS.BodyType[] = [];
  private decorative: Phaser.GameObjects.Graphics[] = [];
  private goalBody: MatterJS.BodyType | null = null;
  private trapBodies: MatterJS.BodyType[] = [];
  private hud!: HTMLElement;
  private timerEl!: HTMLElement;
  private levelEl!: HTMLElement;
  private winLayer!: HTMLElement;
  private startScreen!: HTMLElement;
  private sensorBanner: HTMLElement | null = null;
  private desktopHintTimer: ReturnType<typeof setTimeout> | null = null;
  private mouseOverlay: MouseTiltOverlay | null = null;
  private btnMouseToggle: HTMLButtonElement | null = null;
  private sensorDebugEl: HTMLElement | null = null;
  private sensorDebugTimer: ReturnType<typeof setInterval> | null = null;
  private lastVibrateAt = 0;
  private sensorStorage: StorageLike = typeof sessionStorage !== "undefined" ? sessionStorage : { getItem: () => null, setItem: () => undefined };
  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    const qs = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
    const skipSensorBanner = qs.get("e2e") === "1";
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
      ...(skipSensorBanner
        ? {}
        : {
            onSensorDesktopHint: () => this.maybeShowDesktopSensorHint(),
            onSensorDataStale: () => this.maybeShowFullSensorWarning(),
            onSensorDataRecovered: () => this.onSensorValidDataRecovered()
          })
    });

    this.scale.on("resize", this.layoutHud, this);
    this.layoutHud(this.scale.gameSize);

    this.matter.world.on("collisionstart", this.onCollisionStart, this);

    this.game.events.on("debug-complete-level", this.debugWinLevel, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.sensorDebugTimer) {
        clearInterval(this.sensorDebugTimer);
        this.sensorDebugTimer = null;
      }
      if (this.desktopHintTimer) {
        clearTimeout(this.desktopHintTimer);
        this.desktopHintTimer = null;
      }
      this.sensorDebugEl?.remove();
      this.sensorDebugEl = null;
      this.mouseOverlay?.destroy();
      this.mouseOverlay = null;
      this.tilt.destroy();
      this.game.events.off("debug-complete-level", this.debugWinLevel, this);
      this.matter.world.off("collisionstart", this.onCollisionStart, this);
    });

    this.loadLevel(0);

    if (qs.get("sensorDebug") === "1") {
      this.setupSensorDebugOverlay();
    }

    if (qs.get("e2e") === "1") {
      const w = window as unknown as {
        __tiltMazeScene?: GameScene;
        __loadLevel?: (n: number) => void;
      };
      w.__tiltMazeScene = this;
      w.__loadLevel = (n: number) => this.loadLevel(n);
    }

    this.attachBuildInfoLabel();
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

  private attachBuildInfoLabel(): void {
    const el = document.createElement("div");
    el.id = "tilt-maze-build-info";
    el.textContent = BUILD_INFO_LABEL;
    el.style.cssText = [
      "position:fixed",
      "right:10px",
      "bottom:8px",
      "z-index:2147483645",
      "font:10px/1.3 system-ui,sans-serif",
      "color:rgba(245,230,211,0.72)",
      "text-shadow:0 1px 2px #000",
      "pointer-events:none",
      "max-width:min(90vw,420px)",
      "text-align:right",
      "white-space:pre-wrap",
      "word-break:break-word"
    ].join(";");
    document.body.appendChild(el);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      el.remove();
    });
  }

  update(_time: number, delta: number): void {
    if (!this.running || !this.ball?.body) return;
    this.elapsedMs += delta;

    const t = this.tilt.update(delta, 1);
    const fx = t.ax * FORCE_MULT;
    const fy = t.ay * FORCE_MULT;
    const bb = this.ball.body as MatterJS.BodyType;
    this.matter.body.applyForce(bb, bb.position, { x: fx, y: fy });

    const v = bb.velocity;
    const sp = Math.hypot(v.x, v.y);
    if (sp > MAX_SPEED) {
      const k = MAX_SPEED / sp;
      this.matter.body.setVelocity(bb, { x: v.x * k, y: v.y * k });
    }

    this.timerEl.textContent = this.formatTime(this.elapsedMs);
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
    const root = document.createElement("div");
    root.id = "tilt-maze-ui";
    root.style.cssText = [
      "position:fixed",
      "inset:0",
      "pointer-events:none",
      "font-family:system-ui,Segoe UI,Roboto,sans-serif",
      "z-index:10"
    ].join(";");

    this.startScreen = document.createElement("div");
    this.startScreen.style.cssText = [
      "position:absolute",
      "inset:0",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "background:rgba(15,10,6,0.88)",
      "pointer-events:auto",
      "padding:24px",
      "box-sizing:border-box",
      "text-align:center",
      "color:#f5e6d3"
    ].join(";");
    this.startScreen.innerHTML = `
      <h1 style="margin:0 0 12px;font-size:1.5rem;font-weight:700">Sklopený labyrint</h1>
      <p style="margin:0 0 20px;max-width:320px;line-height:1.45;font-size:0.95rem">
        Nakloňte telefon a doveďte kuličku do cílové díry. Vyhněte se pastem.
        Na ploše: šipky/WASD, nebo myš od středu herní plochy (tlačítko Myš).
      </p>
      <button id="btn-start" type="button" style="padding:14px 28px;font-size:1.05rem;border-radius:12px;border:none;background:#c9a227;color:#1a120a;font-weight:700;cursor:pointer">
        Start
      </button>
      <p style="margin:16px 0 0;font-size:0.75rem;opacity:0.75">
        Vyžaduje HTTPS (Chrome na Androidu). iOS: po Start může systém vyžádat přístup k pohybu.
        Brave: povolte „Motion sensors“ u stránky; Shields může senzory blokovat.
      </p>
    `;

    const hud = document.createElement("div");
    hud.style.cssText = [
      "position:absolute",
      "top:0",
      "left:0",
      "right:0",
      "display:none",
      "flex-wrap:wrap",
      "gap:8px",
      "padding:12px",
      "pointer-events:auto",
      "align-items:center",
      "justify-content:space-between",
      "color:#fff",
      "text-shadow:0 1px 2px #000"
    ].join(";");
    this.hud = hud;

    this.levelEl = document.createElement("div");
    this.levelEl.style.fontWeight = "700";
    this.timerEl = document.createElement("div");

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-left:auto";

    const mkBtn = (id: string, label: string) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = id;
      b.textContent = label;
      b.style.cssText =
        "padding:8px 12px;border-radius:10px;border:1px solid #c9a227;background:#3d2918;color:#f5e6d3;font-size:0.85rem;cursor:pointer";
      return b;
    };

    const btnCal = mkBtn("btn-cal", "Kalibrovat");
    const btnRestart = mkBtn("btn-restart", "Restart");
    const btnMouse = mkBtn("btn-mouse", "Myš");
    btnMouse.setAttribute("aria-pressed", "false");
    btnMouse.title = "Zapnout/vypnout analogové ovládání myší (klávesa M)";
    this.btnMouseToggle = btnMouse;

    const mouseHelp = createMouseHelpPanel();
    actions.append(btnCal, btnRestart, btnMouse, mouseHelp.root);

    hud.append(this.levelEl, this.timerEl, actions);

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

    root.append(this.startScreen, hud, this.winLayer);
    document.body.appendChild(root);

    const btnStart = this.startScreen.querySelector("#btn-start") as HTMLButtonElement;
    btnStart.addEventListener("click", () => void this.onStartClick());

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
    const help = document.getElementById("tilt-maze-mouse-help");
    if (help?.contains(el)) return true;
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

  private setupSensorDebugOverlay(): void {
    if (this.sensorDebugEl) return;
    const el = document.createElement("div");
    el.id = "tilt-maze-sensor-debug";
    el.style.cssText = [
      "position:fixed",
      "top:8px",
      "left:8px",
      "max-width:min(96vw,380px)",
      "background:rgba(0,0,0,0.82)",
      "color:#cfc",
      "font:11px/1.35ui-monospace,monospace",
      "padding:8px 10px",
      "border-radius:8px",
      "z-index:2147483646",
      "pointer-events:none",
      "text-align:left",
      "white-space:pre-wrap",
      "word-break:break-word"
    ].join(";");
    document.body.appendChild(el);
    this.sensorDebugEl = el;
    const tick = (): void => {
      const s = this.tilt.getSensorSnapshot();
      const issue = this.tilt.monitor.classifySensorIssue(performance.now());
      const warn = issue !== "ok" && !this.tilt.isDesktopInputOverride();
      el.textContent = [
        `[sensorDebug] issue=${issue} warn=${warn}`,
        `perm A/G/M: ${s.permAccel}/${s.permGyro}/${s.permMag} denied=${s.permissionDenied}`,
        `orient: ev ${s.orientEvents} valid ${s.orientValid} γ ${s.lastGamma ?? "—"} β ${s.lastBeta ?? "—"}`,
        `motion: ev ${s.motionEvents} valid ${s.motionValid} g ${s.lastGrav ? `${s.lastGrav.x.toFixed(2)},${s.lastGrav.y.toFixed(2)},${s.lastGrav.z ?? "—"}` : "—"}`,
        `gravSensor: ctor ${s.gsConstructorOk} read ${s.gsReadings} err ${s.gsErrors}`,
        s.lastGs ? `  GS ${s.lastGs.x.toFixed(2)},${s.lastGs.y.toFixed(2)},${s.lastGs.z.toFixed(2)}` : "  GS —",
        s.lastGravityError ? `  err: ${s.lastGravityError}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    };
    tick();
    this.sensorDebugTimer = setInterval(tick, 320);
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
    el.textContent =
      "Na tomto zařízení: šipky/WASD, nebo zapni Myš a táhni kurzor od středu herní plochy (viz nápověda).";
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
    // Režim Scale.FIT v main.ts — kamera zůstává 1:1 ve světě DESIGN_WIDTH×DESIGN_HEIGHT, mezery jsou mimo canvas
    const bounds = this.game.scale.canvasBounds;
    if (this.hud) {
      this.hud.style.paddingLeft = `${Math.max(8, Math.round(bounds.x))}px`;
      this.hud.style.paddingRight = `${Math.max(8, Math.round(window.innerWidth - (bounds.x + bounds.width)))}px`;
    }
    this.mouseOverlay?.layout();
  }

  private async onStartClick(): Promise<void> {
    await requestIOSMotionPermission();
    await this.tilt.startSensors();
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

    this.startScreen.style.display = "none";
    this.hud.style.display = "flex";
    this.running = true;
    this.elapsedMs = 0;
  }

  private clearDecor(): void {
    for (const g of this.decorative) g.destroy();
    this.decorative = [];
  }

  private removeBody(b: MatterJS.BodyType): void {
    this.matter.world.remove(b);
  }

  private clearLevelBodies(): void {
    for (const w of this.wallBodies) this.removeBody(w);
    this.wallBodies = [];
    if (this.goalBody) {
      this.removeBody(this.goalBody);
      this.goalBody = null;
    }
    for (const t of this.trapBodies) this.removeBody(t);
    this.trapBodies = [];
    if (this.ball) this.ball.destroy();
    this.clearDecor();
  }

  private loadLevel(index: number): void {
    this.levelIndex = Phaser.Math.Clamp(index, 0, LEVELS.length - 1);
    const lvl = LEVELS[this.levelIndex];
    this.clearLevelBodies();

    this.spawnLevel(lvl);
    this.levelEl.textContent = `Úroveň ${this.levelIndex + 1}/${LEVELS.length} — ${lvl.name}`;
    this.timerEl.textContent = this.formatTime(0);
    this.elapsedMs = 0;
    this.winLayer.style.display = "none";
    this.winLayer.innerHTML = "";
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

    this.goalBody = this.matter.add.circle(lvl.goal.x, lvl.goal.y, lvl.goal.r, {
      isStatic: true,
      isSensor: true,
      label: "goal"
    });
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
      restitution: 0.15
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

      if (ol === "goal") {
        this.winLevel();
        return;
      }
      if (ol === "trap") {
        this.resetBallToStart();
        return;
      }
    }
  }

  private resetBallToStart(): void {
    const lvl = LEVELS[this.levelIndex];
    if (!this.ball?.body) return;
    const bb = this.ball.body as MatterJS.BodyType;
    this.matter.body.setPosition(bb, { x: lvl.start.x, y: lvl.start.y });
    this.matter.body.setVelocity(bb, { x: 0, y: 0 });
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([15, 40, 15]);
      } catch {
        /* ignore */
      }
    }
  }

  private restartLevel(): void {
    this.running = true;
    this.resetBallToStart();
    this.elapsedMs = 0;
    this.winLayer.style.display = "none";
    this.winLayer.innerHTML = "";
  }

  private winLevel(): void {
    this.running = false;
    const next = this.levelIndex + 1;
    const finishedAll = next >= LEVELS.length;
    this.winLayer.innerHTML = `
      <h2 style="margin:0 0 12px;font-size:1.4rem">Výhra!</h2>
      <p style="margin:0 0 8px">Čas: <strong>${this.formatTime(this.elapsedMs)}</strong></p>
      <p style="margin:0 0 20px">${finishedAll ? "Gratulujeme, zvládli jste všechny úrovně!" : "Připravte se na další úroveň."}</p>
      <button id="btn-next" type="button" style="padding:12px 24px;font-size:1rem;border-radius:12px;border:none;background:#c9a227;color:#1a120a;font-weight:700;cursor:pointer">
        ${finishedAll ? "Hrát znovu od začátku" : "Další úroveň"}
      </button>
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
  }

  private formatTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
  }
}
