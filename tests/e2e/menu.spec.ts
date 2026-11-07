import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

test("E2E: úvodní menu — výběr úrovně a návrat z hry", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${basePath}?e2e=1`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });

  await page.locator('button[data-level-index="1"]').click();
  await page.locator("#menu-btn-play").click();

  await expect(page.locator("#tilt-maze-ui")).toBeVisible();
  await expect(page.locator("#btn-menu")).toBeVisible();
  await page.locator("#btn-menu").click();

  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#tilt-maze-ui")).toHaveCount(0);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("E2E: nápověda senzorů v menu", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "domcontentloaded" });
  await page.locator("#menu-btn-help").click();
  await expect(page.getByTestId("help-overlay")).toBeVisible();
  await expect(page.getByTestId("help-overlay").getByText("WASD")).toBeVisible();
  await page.locator("#help-btn-close").click();
  await expect(page.getByTestId("help-overlay")).toHaveCount(0);
});
