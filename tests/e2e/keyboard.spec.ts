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
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${basePath}?e2e=1&matterDebug=1`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();

  const won = page.getByText("Výhra!", { exact: false });
  const deadline = Date.now() + 35000;

  while (Date.now() < deadline) {
    if (await won.isVisible()) break;
    await page.keyboard.down("ArrowUp");
    await sleep(220);
    await page.keyboard.up("ArrowUp");
    if (await won.isVisible()) break;
    await page.keyboard.down("ArrowRight");
    await sleep(160);
    await page.keyboard.up("ArrowRight");
    await sleep(30);
  }

  await expect(won).toBeVisible({ timeout: 2000 });

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
