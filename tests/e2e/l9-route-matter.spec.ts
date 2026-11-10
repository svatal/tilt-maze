import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");
const MIN_CLEAR = 6;

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

test("E2E: úroveň 9 — Matter kulička drží rezervu podél BFS trasy", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1&skipMenu=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !!(window as unknown as { __tiltMazeScene?: { running: boolean } }).__tiltMazeScene?.running,
    undefined,
    { timeout: 20000 }
  );

  await page.evaluate(() => {
    const w = window as unknown as { __loadLevel?: (n: number) => void; __e2eRelayout?: () => void };
    w.__loadLevel?.(8);
    w.__e2eRelayout?.();
  });

  const samples = await page.evaluate(() => {
    const w = window as unknown as { __e2ePathSamples?: (n: number) => { x: number; y: number }[] };
    return w.__e2ePathSamples?.(8) ?? [];
  });
  expect(samples.length).toBeGreaterThan(10);

  let minWall = Number.POSITIVE_INFINITY;
  let minTrap = Number.POSITIVE_INFINITY;

  const stride = 3;
  for (let i = 0; i < samples.length; i += stride) {
    const pt = samples[i];
    await page.evaluate(
      ([x, y]) => {
        const w = window as unknown as {
          __e2ePlaceBall?: (a: number, b: number) => void;
          __e2eMatterStep?: (n?: number) => void;
        };
        w.__e2ePlaceBall?.(x, y);
        w.__e2eMatterStep?.(4);
      },
      [pt.x, pt.y]
    );

    const c = await page.evaluate(() => {
      const w = window as unknown as { __e2eBallSurfaceClearance?: () => { wall: number; trap: number } };
      return w.__e2eBallSurfaceClearance?.() ?? { wall: -1, trap: -1 };
    });

    minWall = Math.min(minWall, c.wall);
    minTrap = Math.min(minTrap, c.trap);
    expect(c.wall, `bod (${pt.x}, ${pt.y})`).toBeGreaterThanOrEqual(MIN_CLEAR - 0.5);
    expect(c.trap, `bod (${pt.x}, ${pt.y})`).toBeGreaterThanOrEqual(MIN_CLEAR - 0.5);
  }

  expect(minWall).toBeGreaterThanOrEqual(MIN_CLEAR);
  expect(minTrap).toBeGreaterThanOrEqual(MIN_CLEAR);
});
