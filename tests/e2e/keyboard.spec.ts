import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS } from "../../src/levels";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

test("E2E: klávesnice posune kuličku + Matter debug bez chyb", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${basePath}?e2e=1&skipMenu=1&matterDebug=1`, { waitUntil: "networkidle" });
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();
  await page.locator("body").click();

  const matterDebug = await page.evaluate(() => {
    const s = (window as unknown as { __tiltMazeScene?: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics } })
      .__tiltMazeScene;
    return !!(s?.matter?.world as unknown as { debugGraphic?: unknown })?.debugGraphic;
  });
  expect(matterDebug).toBe(true);

  const x0 = await page.evaluate(() => (window as unknown as { __tiltMazeScene?: { ball?: { x: number } } }).__tiltMazeScene?.ball?.x ?? 0);

  await page.keyboard.down("ArrowRight");
  await sleep(600);
  await page.keyboard.up("ArrowRight");

  const x1 = await page.evaluate(() => (window as unknown as { __tiltMazeScene?: { ball?: { x: number } } }).__tiltMazeScene?.ball?.x ?? 0);
  expect(x1).toBeGreaterThan(x0 + 3);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("E2E: klávesnice + lokální sklon cíle → výhra (stejný flow jako holes)", async ({ page }) => {
  const g = LEVELS[0].goal;
  const ballY = g.y + g.r * 0.65;

  await page.goto(`${basePath}?e2e=1&skipMenu=1`, { waitUntil: "networkidle" });

  await page.evaluate(
    ({ x, y }) => {
      const w = window as unknown as { __e2ePlaceBall?: (px: number, py: number) => void };
      w.__e2ePlaceBall?.(x, y);
    },
    { x: g.x, y: ballY }
  );
  await sleep(200);
  await page.keyboard.down("ArrowUp");
  await sleep(1200);
  await page.keyboard.up("ArrowUp");

  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 6000 });

  await fs.promises.mkdir("/opt/cursor/artifacts", { recursive: true });
  await page.screenshot({ path: "/opt/cursor/artifacts/screenshot.png", fullPage: true });
});

test("E2E: debug hook dokončí úroveň (regrese)", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${basePath}?e2e=1&skipMenu=1`, { waitUntil: "networkidle" });
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __debugCompleteLevel?: () => void }).__debugCompleteLevel?.();
  });
  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 10000 });
  expect(errors, errors.join("\n")).toEqual([]);
});
