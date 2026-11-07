import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

test("E2E: analogová myš — aktivace, indikátor, bez tiltu před zapnutím", async ({ page, viewport }) => {
  await page.setViewportSize(viewport ?? { width: 520, height: 900 });

  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page.locator("#tilt-maze-mouse-overlay")).toBeHidden();

  const canvas = page.locator("#game-container canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rightX = cx + box.width * 0.35;

  await page.mouse.move(cx, cy);
  await sleep(120);
  let armed = await page.evaluate(() => {
    const scene = (window as unknown as { __tiltMazeScene?: { tilt: { isMouseArmed: () => boolean } } }).__tiltMazeScene;
    return scene?.tilt.isMouseArmed() ?? false;
  });
  expect(armed).toBe(false);

  await page.getByRole("button", { name: "Myš", exact: true }).click();
  await expect(page.locator("#tilt-maze-mouse-overlay")).toBeVisible();

  await page.mouse.move(rightX, cy);
  await sleep(200);

  const raw = await page.evaluate(() => {
    const scene = (window as unknown as {
      __tiltMazeScene?: { tilt: { update: (d: number, s: number) => { ax: number; ay: number } } };
    }).__tiltMazeScene;
    return scene?.tilt.update(16, 1) ?? { ax: 0, ay: 0 };
  });
  expect(Math.abs(raw.ax)).toBeGreaterThan(0.02);

  await page.getByRole("button", { name: "Myš", exact: true }).click();
  await expect(page.locator("#tilt-maze-mouse-overlay")).toBeHidden();

  await fs.promises.mkdir("/opt/cursor/artifacts", { recursive: true });
  await page.getByRole("button", { name: "Myš", exact: true }).click();
  await page.mouse.move(rightX, cy);
  await sleep(150);
  await page.screenshot({ path: "/opt/cursor/artifacts/mouse-tilt-desktop.png", fullPage: true });

  expect(errors, errors.join("\n")).toEqual([]);
});

test("E2E: landscape layout — ovládací plocha a overlay", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 900, height: 520 } });
  const page = await context.newPage();
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Myš", exact: true }).click();
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator("#tilt-maze-mouse-overlay")).toBeVisible();
  await context.close();
});
