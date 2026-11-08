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

test("E2E: past zachytí průlet středu (segment)", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();

  const trapped = await page.evaluate(async () => {
    const w = window as unknown as {
      __e2eSimulateTrapFrame?: (x0: number, y0: number, x1: number, y1: number) => boolean;
      __e2eHoleState?: () => { trapSinking: boolean };
    };
    // Past úroveň 1: (180, 320), r=22
    return w.__e2eSimulateTrapFrame?.(150, 320, 210, 320) ?? false;
  });
  expect(trapped).toBe(true);

  await sleep(320);
  const sinking = await page.evaluate(() => {
    const w = window as unknown as { __e2eHoleState?: () => { trapSinking: boolean } };
    return w.__e2eHoleState?.().trapSinking ?? false;
  });
  expect(sinking).toBe(false);
});

test("E2E: cíl — sesazení a výhra po vložení kuličky dovnitř", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();

  await page.evaluate(() => {
    const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void };
    w.__e2ePlaceBall?.(300, 80);
  });

  await sleep(550);
  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 4000 });
});
