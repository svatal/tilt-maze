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

test("E2E: úroveň 1 klávesnicí + overlay Matter debug, bez chyb v konzoli", async ({ page }) => {
  test.setTimeout(75_000);
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${basePath}?e2e=1&matterDebug=1`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();

  const won = page.getByText("Výhra!", { exact: false });

  const holdKey = async (key: string, ms: number) => {
    if (await won.isVisible()) return;
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
    await sleep(40);
  };

  // Úroveň 1: levačkou nahoru, pak doladění do cíle (300, 80)
  await holdKey("ArrowUp", 2000);
  await holdKey("ArrowRight", 520);
  await holdKey("ArrowUp", 14000);

  const goal = { x: 300, y: 80 };
  for (let i = 0; i < 120; i++) {
    if (await won.isVisible()) break;
    const pos = await page.evaluate(() => {
      const ball = (window as unknown as { __tiltMazeScene?: { ball?: { x: number; y: number } } })
        .__tiltMazeScene?.ball;
      return ball ? { x: ball.x, y: ball.y } : null;
    });
    if (!pos) break;
    const dx = pos.x - goal.x;
    const dy = pos.y - goal.y;
    if (Math.hypot(dx, dy) < 18) {
      await holdKey("ArrowLeft", dx > 2 ? 55 : 0);
      await holdKey("ArrowRight", dx < -2 ? 55 : 0);
      await holdKey("ArrowDown", dy < -2 ? 70 : 0);
      await holdKey("ArrowUp", dy > 2 ? 70 : 0);
      await sleep(120);
    } else if (dy < -6) await holdKey("ArrowDown", 85);
    else if (dy > 6) await holdKey("ArrowUp", 85);
    else if (dx > 6) await holdKey("ArrowLeft", 85);
    else await holdKey("ArrowRight", 85);
  }

  await expect(won).toBeVisible({ timeout: 15000 });

  await fs.promises.mkdir("/opt/cursor/artifacts", { recursive: true });
  await page.screenshot({ path: "/opt/cursor/artifacts/screenshot.png", fullPage: true });

  expect(errors, errors.join("\n")).toEqual([]);
});

test("E2E: debug hook dokončí úroveň (regrese)", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();
  await page.evaluate(() => {
    (window as unknown as { __debugCompleteLevel?: () => void }).__debugCompleteLevel?.();
  });
  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 10000 });
  expect(errors, errors.join("\n")).toEqual([]);
});
