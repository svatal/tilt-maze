import Phaser from "phaser";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./constants";
import { validateLevelSet } from "./levelGeometry";
import { assertAllLevelsSolvable } from "./levelSolvability";
import { LEVELS } from "./levels";
import { GameScene } from "./scenes/GameScene";
import { MenuScene } from "./scenes/MenuScene";

if (import.meta.env.VITE_DISABLE_PWA !== "true") {
  void import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
validateLevelSet(LEVELS);
assertAllLevelsSolvable(LEVELS);

const container = document.getElementById("game-container");
if (!container) {
  throw new Error("Chybí #game-container");
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: container,
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT
  },
  backgroundColor: "#1a120a",
  scene: [MenuScene, GameScene],
  physics: {
    default: "matter",
    matter: {
      gravity: { y: 0, x: 0 },
      debug: false
    }
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: false
  }
};

const game = new Phaser.Game(config);

window.addEventListener("resize", () => {
  game.scale.refresh();
});

const qs = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
if (qs.get("e2e") === "1") {
  (window as unknown as { __tiltMazeGame?: Phaser.Game }).__tiltMazeGame = game;
  (window as unknown as { __debugCompleteLevel?: () => void }).__debugCompleteLevel = () => {
    game.events.emit("debug-complete-level");
  };
}
