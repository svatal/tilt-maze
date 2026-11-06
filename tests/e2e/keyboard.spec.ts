import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

test("klávesnice: start, debug dokončí úroveň, bez chyb v konzoli", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto("/tilt-maze/", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();

  await page.evaluate(() => {
    (window as unknown as { __debugCompleteLevel?: () => void }).__debugCompleteLevel?.();
  });

  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 10000 });

  await fs.promises.mkdir("/opt/cursor/artifacts", { recursive: true });
  await page.screenshot({ path: "/opt/cursor/artifacts/screenshot.png", fullPage: true });

  expect(errors, errors.join("\n")).toEqual([]);
});
