import Phaser from "phaser";
import { registerSW } from "virtual:pwa-register";
import { GameScene } from "./scenes/GameScene";

registerSW({ immediate: true });

const container = document.getElementById("game-container");
if (!container) {
  throw new Error("Chybí #game-container");
}

function gameSize(): { width: number; height: number } {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  return { width: w, height: h };
}

const initial = gameSize();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: container,
  width: initial.width,
  height: initial.height,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: initial.width,
    height: initial.height
  },
  backgroundColor: "#1a120a",
  scene: [GameScene],
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
  const { width, height } = gameSize();
  game.scale.resize(width, height);
});

// E2E / ladění: dokončení úrovně z konzole
(window as unknown as { __debugCompleteLevel?: () => void }).__debugCompleteLevel = () => {
  game.events.emit("debug-complete-level");
};
