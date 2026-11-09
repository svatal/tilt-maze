import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { driveMouseTilt } from "./helpers/playwrightTilt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

test("E2E: myš posune kuličku + Matter debug bez chyb", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${basePath}?e2e=1&skipMenu=1&matterDebug=1`, { waitUntil: "networkidle" });
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();

  const x0 = await page.evaluate(() => (window as unknown as { __tiltMazeScene?: { ball?: { x: number } } }).__tiltMazeScene?.ball?.x ?? 0);

  await driveMouseTilt(page, { nx: 1, ny: 0 }, 650);

  const x1 = await page.evaluate(() => (window as unknown as { __tiltMazeScene?: { ball?: { x: number } } }).__tiltMazeScene?.ball?.x ?? 0);
  expect(x1).toBeGreaterThan(x0 + 3);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("E2E: myš + lokální sklon cíle → výhra (stejný flow jako holes)", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1&skipMenu=1`, { waitUntil: "networkidle" });

  await page.evaluate(() => {
    const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void };
    w.__e2ePlaceBall?.(300, 102);
  });
  await driveMouseTilt(page, { nx: 0, ny: -1 }, 1400);

  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 8000 });

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
  await page.evaluate(() => {
    (window as unknown as { __debugCompleteLevel?: () => void }).__debugCompleteLevel?.();
  });
  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 10000 });
  expect(errors, errors.join("\n")).toEqual([]);
});
