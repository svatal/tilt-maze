import Phaser from "phaser";
import { DESIGN_HEIGHT, DESIGN_WIDTH, LEVELS, type LevelDef } from "../levels";
import { TiltController } from "../tilt";

const BALL_RADIUS = 11;
const WALL_FRICTION = 0.08;
const FORCE_MULT = 0.00085;
const MAX_SPEED = 7;

export class GameScene extends Phaser.Scene {
  private tilt = new TiltController();
  private ball!: Phaser.Physics.Matter.Image;
  private levelIndex = 0;
  private elapsedMs = 0;
  private running = false;
  private wallBodies: Phaser.Physics.Matter.Image[] = [];
  /** Grafika děr (cíl, pasti) — odděleně od fyziky */
  private decorative: Phaser.GameObjects.Graphics[] = [];
  private goalObj: Phaser.Physics.Matter.Image | null = null;
  private trapObjs: Phaser.Physics.Matter.Image[] = [];
  private hud!: HTMLElement;
  private timerEl!: HTMLElement;
  private levelEl!: HTMLElement;
  private winLayer!: HTMLElement;
  private startScreen!: HTMLElement;
  private lastVibrateAt = 0;

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.ensureTextures();
    this.matter.world.setBounds(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 32, true, true, true, true);
    this.matter.world.setGravity(0, 0);

    this.buildBackground();
    this.buildHud();

    this.scale.on("resize", this.layoutHud, this);
    this.layoutHud(this.scale.gameSize);

    this.matter.world.on("collisionstart", this.onCollisionStart, this);

    this.game.events.on("debug-complete-level", this.debugWinLevel, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tilt.destroy();
      this.game.events.off("debug-complete-level", this.debugWinLevel, this);
      this.matter.world.off("collisionstart", this.onCollisionStart, this);
    });

    this.loadLevel(0);
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
        Na ploše lze použít šipky nebo WASD.
      </p>
      <button id="btn-start" type="button" style="padding:14px 28px;font-size:1.05rem;border-radius:12px;border:none;background:#c9a227;color:#1a120a;font-weight:700;cursor:pointer">
        Start
      </button>
      <p style="margin:16px 0 0;font-size:0.75rem;opacity:0.75">Android Chrome: HTTPS. iOS: po klepnutí na Start se může vyžádat přístup k pohybu.</p>
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
    actions.append(btnCal, btnRestart);

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

  private layoutHud(size: Phaser.Structs.Size): void {
    const cam = this.cameras.main;
    const sx = size.width / DESIGN_WIDTH;
    const sy = size.height / DESIGN_HEIGHT;
    const z = Math.min(sx, sy);
    cam.setZoom(z);
    const offX = (size.width - DESIGN_WIDTH * z) / 2;
    const offY = (size.height - DESIGN_HEIGHT * z) / 2;
    cam.setOrigin(0, 0);
    cam.setScroll(-offX / z, -offY / z);
    if (this.hud) {
      this.hud.style.paddingLeft = `${Math.max(8, offX)}px`;
      this.hud.style.paddingRight = `${Math.max(8, offX)}px`;
    }
  }

  private async onStartClick(): Promise<void> {
    const iosOk = await TiltController.requestPermissionIOS();
    if (!iosOk) {
      console.warn("Přístup k orientaci zamítnut, použijte klávesnici nebo zkuste znovu.");
    }
    this.tilt.startSensors();
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

  private clearLevelBodies(): void {
    for (const w of this.wallBodies) w.destroy();
    this.wallBodies = [];
    if (this.goalObj) this.goalObj.destroy();
    this.goalObj = null;
    for (const t of this.trapObjs) t.destroy();
    this.trapObjs = [];
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
      const wall = this.matter.add.gameObject(gr, {
        shape: {
          type: "rectangle",
          x: w.cx,
          y: w.cy,
          width: w.w,
          height: w.h
        },
        isStatic: true,
        friction: WALL_FRICTION,
        restitution: 0.05,
        label: "wall"
      }) as Phaser.Physics.Matter.Image;
      this.wallBodies.push(wall);
    }

    const goalVis = this.add.circle(lvl.goal.x, lvl.goal.y, lvl.goal.r, 0x000000, 0);
    this.goalObj = this.matter.add.gameObject(goalVis, {
      shape: {
        type: "circle",
        x: lvl.goal.x,
        y: lvl.goal.y,
        radius: lvl.goal.r
      },
      isStatic: true,
      isSensor: true,
      label: "goal"
    }) as Phaser.Physics.Matter.Image;
    this.drawHole(lvl.goal.x, lvl.goal.y, lvl.goal.r, 0x0d3d0d);

    for (const tr of lvl.traps) {
      const trapVis = this.add.circle(tr.x, tr.y, tr.r, 0x000000, 0);
      const trap = this.matter.add.gameObject(trapVis, {
        shape: { type: "circle", x: tr.x, y: tr.y, radius: tr.r },
        isStatic: true,
        isSensor: true,
        label: "trap"
      }) as Phaser.Physics.Matter.Image;
      this.trapObjs.push(trap);
      this.drawHole(tr.x, tr.y, tr.r, 0x2a0a0a);
    }

    this.ball = this.matter.add.image(lvl.start.x, lvl.start.y, "ball_tex");
    this.ball = this.matter.add.gameObject(this.ball, {
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
