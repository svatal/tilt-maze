import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  dismissSensorBannerIfPresent,
  startGameFromMenu
} from "./helpers/playwrightTilt";

const artifacts = "/opt/cursor/artifacts";
const L16 = 15;
/** Koridor pod mostem — obrys vidět skrz desku. */
const UNDER = { x: 180, y: 392 };
/** Střed rozponu mostu na patře. */
const ON_DECK = { x: 200, y: 324 };

test.beforeAll(() => {
  fs.mkdirSync(artifacts, { recursive: true });
});

test("bridge PR artefakty: pod mostem a na patře", async ({ browser }) => {
  test.setTimeout(90_000);
  for (const [view, w, h] of [
    ["desktop", 1280, 800],
    ["mobile", 390, 844]
  ] as const) {
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await context.newPage();
    try {
      await startGameFromMenu(page, L16);
      await dismissSensorBannerIfPresent(page);
      await page.getByRole("button", { name: "Myš", exact: true }).click();
      await expect(page.locator("#tilt-maze-sensor-warn")).toHaveCount(0);

      await page.evaluate(
        ([x, y]) => {
          const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void };
          w.__e2ePlaceBall?.(x, y);
        },
        [UNDER.x, UNDER.y]
      );
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(artifacts, `bridge-under-${view}-${w}x${h}.png`),
        fullPage: false
      });

      await page.evaluate(
        ([x, y]) => {
          const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void };
          w.__e2ePlaceBall?.(x, y);
        },
        [ON_DECK.x, ON_DECK.y]
      );
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(artifacts, `bridge-deck-${view}-${w}x${h}.png`),
        fullPage: false
      });
    } finally {
      await context.close();
    }
  }
});