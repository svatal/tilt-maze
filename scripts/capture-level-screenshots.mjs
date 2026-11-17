import { chromium, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

const outDir = "/opt/cursor/artifacts/floor-blocks-pr-v2";
fs.mkdirSync(outDir, { recursive: true });
const levels = [
  { index: 4, id: 5 },
  { index: 10, id: 11 },
  { index: 13, id: 14 }
];
const viewports = [
  { name: "desktop-1280x800", width: 1280, height: 800 },
  { name: "mobile-390x844", ...devices["iPhone 12"].viewport, isMobile: true }
];

async function shot(page, levelIndex, file) {
  await page.goto("http://127.0.0.1:4173/tilt-maze/?e2e=1", { waitUntil: "domcontentloaded" });
  await page.getByTestId("main-menu").waitFor({ state: "visible", timeout: 15000 });
  const dismiss = page.locator("#sensor-dismiss");
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await page.locator(`button[data-level-index="${levelIndex}"]`).click();
  await page.locator("#tilt-maze-ui").waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: file });
}

const browser = await chromium.launch();
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: Boolean(vp.isMobile),
    hasTouch: Boolean(vp.isMobile)
  });
  const page = await context.newPage();
  for (const { index, id } of levels) {
    await shot(page, index, path.join(outDir, `level-${id}-${vp.name}.png`));
  }
  await context.close();
}
await browser.close();