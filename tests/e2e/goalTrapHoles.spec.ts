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

test("E2E: cíl — usazení a jedna výhra", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();

  await page.evaluate(() => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number, vx?: number, vy?: number) => void;
    };
    w.__e2ePlaceBall?.(298, 82, 0.35, 0.15);
  });

  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 15000 });
  await fs.promises.mkdir("/opt/cursor/artifacts", { recursive: true });
  await page.screenshot({ path: "/opt/cursor/artifacts/goal-settle-win.png", fullPage: true });
});

const TRAP_L1 = { x: 180, y: 320, r: 22 };

test("E2E: past — okraj disku (černá díra) + vysoká rychlost", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();

  const rimX = TRAP_L1.x + TRAP_L1.r - 1;
  await page.evaluate(
    ({ x, y }) => {
      (window as unknown as { __e2ePlaceBall?: (a: number, b: number, vx?: number, vy?: number) => void }).__e2ePlaceBall?.(
        x,
        y,
        7.5,
        0
      );
    },
    { x: rimX, y: TRAP_L1.y }
  );

  let sawFall = false;
  for (let i = 0; i < 28; i++) {
    const snap = await page.evaluate(() => {
      const w = window as unknown as { __e2eTrapSnapshot?: () => { falling: boolean; sinkT: number } };
      return w.__e2eTrapSnapshot?.() ?? { falling: false, sinkT: 0 };
    });
    if (snap.falling || snap.sinkT > 0.08) sawFall = true;
    await page.waitForTimeout(20);
  }
  expect(sawFall).toBe(true);
  await page.waitForFunction(
    () => {
      const b = (window as unknown as { __tiltMazeScene?: { ball?: { y: number } } }).__tiltMazeScene?.ball;
      return !!b && b.y > 550;
    },
    { timeout: 6000 }
  );
  for (let i = 0; i < 8; i++) {
    await page.keyboard.down("ArrowUp");
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(30);
    await page.keyboard.up("ArrowUp");
    await page.keyboard.up("ArrowRight");
    const snap = await page.evaluate(() => {
      const w = window as unknown as { __e2eTrapSnapshot?: () => { falling: boolean } };
      return w.__e2eTrapSnapshot?.() ?? { falling: false };
    });
    expect(snap.falling).toBe(false);
  }
  await fs.promises.mkdir("/opt/cursor/artifacts", { recursive: true });
  await page.screenshot({ path: "/opt/cursor/artifacts/trap-blackhole-rim.png", fullPage: true });
});

test("E2E: past — mimo disk (střed) bez pádu", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();

  const outsideX = TRAP_L1.x + TRAP_L1.r + 12;
  await page.evaluate(
    ({ x, y }) => {
      (window as unknown as { __e2ePlaceBall?: (a: number, b: number, vx?: number, vy?: number) => void }).__e2ePlaceBall?.(
        x,
        y,
        0,
        4.5
      );
    },
    { x: outsideX, y: TRAP_L1.y }
  );
  await page.waitForTimeout(400);
  const snap = await page.evaluate(() => {
    const w = window as unknown as {
      __e2eTrapSnapshot?: () => { falling: boolean; sinkT: number };
      __tiltMazeScene?: { ball?: { x: number; y: number } };
    };
    return {
      trap: w.__e2eTrapSnapshot?.(),
      ball: w.__tiltMazeScene?.ball
    };
  });
  expect(snap.trap?.falling).not.toBe(true);
  expect(Math.abs((snap.ball?.x ?? 0) - outsideX)).toBeLessThan(8);
});

test("E2E: past — průlet středem (rx≈6) vidí pád a jeden respawn", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();

  await page.evaluate(() => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number, vx?: number, vy?: number) => void;
    };
    w.__e2ePlaceBall?.(142, 320, 6.2, 0);
  });

  let sawFall = false;
  for (let i = 0; i < 40; i++) {
    const snap = await page.evaluate(() => {
      const w = window as unknown as {
        __e2eTrapSnapshot?: () => { falling: boolean; sinkT: number };
      };
      return w.__e2eTrapSnapshot?.() ?? { falling: false, sinkT: 0 };
    });
    if (snap.falling || snap.sinkT > 0.05) sawFall = true;
    await page.waitForTimeout(25);
  }
  expect(sawFall).toBe(true);

  await page.waitForFunction(
    () => {
      const b = (window as unknown as { __tiltMazeScene?: { ball?: { y: number } } }).__tiltMazeScene?.ball;
      return !!b && b.y > 520;
    },
    { timeout: 8000 }
  );
  const pos = await page.evaluate(() => {
    const b = (window as unknown as { __tiltMazeScene?: { ball?: { x: number; y: number } } }).__tiltMazeScene
      ?.ball;
    return b ? { x: Math.round(b.x), y: Math.round(b.y) } : null;
  });
  expect(pos!.y).toBeGreaterThan(520);
  await fs.promises.mkdir("/opt/cursor/artifacts", { recursive: true });
  await page.screenshot({ path: "/opt/cursor/artifacts/trap-center-cross-6.png", fullPage: true });
});

test("E2E: past — jeden odložený respawn", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();

  await page.evaluate(() => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number, vx?: number, vy?: number) => void;
    };
    w.__e2ePlaceBall?.(181, 322, 0.2, 0.05);
  });

  await page.waitForTimeout(1200);
  const pos = await page.evaluate(() => {
    const w = window as unknown as {
      __tiltMazeScene?: { ball?: { x: number; y: number } };
    };
    const b = w.__tiltMazeScene?.ball;
    return b ? { x: Math.round(b.x), y: Math.round(b.y) } : null;
  });
  expect(pos).not.toBeNull();
  expect(pos!.x).toBeGreaterThan(40);
  expect(pos!.y).toBeGreaterThan(520);
  await fs.promises.mkdir("/opt/cursor/artifacts", { recursive: true });
  await page.screenshot({ path: "/opt/cursor/artifacts/trap-respawn.png", fullPage: true });
});

test("E2E: restart během pádu pasti — zruší pád a vrátí míček", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start" }).click();

  await page.evaluate(() => {
    const w = window as unknown as {
      __e2ePlaceBall?: (x: number, y: number, vx?: number, vy?: number) => void;
    };
    w.__e2ePlaceBall?.(181, 322, 0.15, 0.05);
  });
  await page.waitForTimeout(80);
  await page.getByRole("button", { name: "Restart" }).click();
  await page.waitForTimeout(200);

  const pos = await page.evaluate(() => {
    const w = window as unknown as {
      __tiltMazeScene?: { ball?: { x: number; y: number } };
    };
    const b = w.__tiltMazeScene?.ball;
    return b ? { x: Math.round(b.x), y: Math.round(b.y) } : null;
  });
  expect(pos!.y).toBeGreaterThan(550);
  await expect(page.getByText("Výhra!", { exact: false })).toBeHidden();
});
