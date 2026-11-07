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

async function screenshotLevels(page: import("@playwright/test").Page, view: string) {
  await page.goto(`${basePath}?e2e=1&skipMenu=1&matterDebug=1`, { waitUntil: "networkidle" });

  for (let i = 0; i < 3; i++) {
    await page.evaluate((n) => {
      (window as unknown as { __loadLevel?: (x: number) => void }).__loadLevel?.(n);
    }, i);

    const ok = await page.evaluate(() => {
      const s = (window as unknown as { __tiltMazeScene?: { verifyWallsFitDesignBoard: () => boolean } }).__tiltMazeScene;
      return s?.verifyWallsFitDesignBoard() ?? false;
    });
    expect(ok, `úroveň ${i + 1} má zeď mimo desku`).toBe(true);

    await fs.promises.mkdir("/opt/cursor/artifacts", { recursive: true });
    await page.screenshot({
      path: `/opt/cursor/artifacts/board-${view}-level-${i + 1}.png`,
      fullPage: true
    });
  }
}

test("deska: 1024×549 — všechny zdi uvnitř rámu", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 549 });
  await screenshotLevels(page, "1024x549");
});

test("deska: 412×915 — všechny zdi uvnitř rámu", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await screenshotLevels(page, "412x915");
});
