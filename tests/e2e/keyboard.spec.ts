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

async function holdKeys(
  page: import("@playwright/test").Page,
  keys: string[],
  ms: number
): Promise<void> {
  for (const k of keys) await page.keyboard.down(k);
  await sleep(ms);
  for (const k of keys) await page.keyboard.up(k);
}

test("E2E: úroveň 1 klávesnice posune kuličku + Matter debug, bez chyb v konzoli", async ({ page }) => {
  test.setTimeout(45_000);

  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${basePath}?e2e=1&matterDebug=1`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();
  await page.locator("body").click();

  const matterDebug = await page.evaluate(() => {
    const s = (window as unknown as { __tiltMazeScene?: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics } })
      .__tiltMazeScene;
    return !!(s?.matter?.world as unknown as { debugGraphic?: unknown })?.debugGraphic;
  });
  expect(matterDebug).toBe(true);

  const ballPos = async () =>
    page.evaluate(() => {
      const s = (window as unknown as { __tiltMazeScene?: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics } })
        .__tiltMazeScene;
      const ball = s!.matter.world.getAllBodies().find((b) => b.label === "ball");
      return { x: ball!.position.x, y: ball!.position.y };
    });

  const start = await ballPos();
  await holdKeys(page, ["ArrowUp", "ArrowRight"], 3200);
  const after = await ballPos();
  const travel = Math.hypot(after.x - start.x, after.y - start.y);

  expect(after.y).toBeLessThan(start.y - 40);
  expect(travel).toBeGreaterThan(120);

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
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __debugCompleteLevel?: () => void }).__debugCompleteLevel?.();
  });
  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 10000 });
  expect(errors, errors.join("\n")).toEqual([]);
});
