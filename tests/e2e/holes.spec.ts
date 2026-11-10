import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HOLE_TRIGGER_FRAC, holeTriggerRadius } from "../../src/holeSlope";
import { LEVELS } from "../../src/levels";
import { driveMouseTilt } from "./helpers/playwrightTilt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");

/** Úroveň s pastí pro E2E fyziku děr (id 6 — první úroveň s pastí v aktuálním LEVELS). */
const E2E_HOLE_LEVEL_INDEX = LEVELS.findIndex((l) => l.traps.length > 0);
if (E2E_HOLE_LEVEL_INDEX < 0) {
  throw new Error("LEVELS musí obsahovat alespoň jednu úroveň s pastí pro holes.spec");
}
const holeLvl = LEVELS[E2E_HOLE_LEVEL_INDEX];
const TRAP = {
  cx: holeLvl.traps[0].x,
  cy: holeLvl.traps[0].y,
  r: holeLvl.traps[0].r
};
const GOAL = { cx: holeLvl.goal.x, cy: holeLvl.goal.y, r: holeLvl.goal.r };
const TRIGGER_FRAC = HOLE_TRIGGER_FRAC;
const innerTrapR = holeTriggerRadius(TRAP.r);
const innerGoalR = holeTriggerRadius(GOAL.r);

test.beforeAll(() => {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("Spusťte nejdřív npm run build (chybí dist/)");
  }
});

async function startHoleLevel(page: import("@playwright/test").Page) {
  await page.goto(`${basePath}?e2e=1&skipMenu=1`, { waitUntil: "networkidle" });
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();
  await page.evaluate((idx) => {
    (window as unknown as { __loadLevel?: (n: number) => void }).__loadLevel?.(idx);
  }, E2E_HOLE_LEVEL_INDEX);
}

test("E2E past: okraj viditelné díry (dist≈r) nespustí animaci", async ({ page }) => {
  await startHoleLevel(page);
  await page.evaluate(
    ({ px, py }) => {
      const w = window as unknown as {
        __e2ePlaceBall?: (x: number, y: number) => void;
        __e2eTickHoles?: () => void;
      };
      w.__e2ePlaceBall?.(px, py);
      w.__e2eTickHoles?.();
    },
    { px: TRAP.cx + TRAP.r, py: TRAP.cy }
  );
  const st = await page.evaluate(() => {
    const w = window as unknown as { __e2eHoleState?: () => { trapSinking: boolean; lastTriggerDist: number | null } };
    return w.__e2eHoleState?.();
  });
  expect(st?.trapSinking).toBe(false);
  expect(st?.lastTriggerDist).toBeNull();
});

test("E2E past: na 0.5r už není trigger (jen mezikruh)", async ({ page }) => {
  await startHoleLevel(page);
  await page.evaluate(
    ({ px, py }) => {
      const w = window as unknown as {
        __e2ePlaceBall?: (x: number, y: number) => void;
        __e2eTickHoles?: () => void;
      };
      w.__e2ePlaceBall?.(px, py);
      w.__e2eTickHoles?.();
    },
    { px: TRAP.cx + TRAP.r * 0.5, py: TRAP.cy }
  );
  const st = await page.evaluate(() => {
    const w = window as unknown as { __e2eHoleState?: () => { trapSinking: boolean } };
    return w.__e2eHoleState?.();
  });
  expect(st?.trapSinking).toBe(false);
});

test("E2E past: na okraji silný lokální tah (≈45°) bez animace", async ({ page }) => {
  await startHoleLevel(page);
  const rim = await page.evaluate(
    ({ px, py }) => {
      const w = window as unknown as {
        __e2ePlaceBall?: (x: number, y: number) => void;
        __e2eHoleLocalMag?: () => number;
        __e2eHoleState?: () => { trapSinking: boolean };
      };
      w.__e2ePlaceBall?.(px, py);
      return {
        mag: w.__e2eHoleLocalMag?.() ?? 0,
        trapSinking: w.__e2eHoleState?.().trapSinking ?? true
      };
    },
    { px: TRAP.cx + TRAP.r - 0.15, py: TRAP.cy }
  );
  expect(rim.trapSinking).toBe(false);
  expect(rim.mag).toBeGreaterThan(1.45);
});

test("E2E past: střed v 0.25r spustí propad", async ({ page }) => {
  await startHoleLevel(page);
  await page.evaluate(
    ({ px, py }) => {
      const w = window as unknown as {
        __e2ePlaceBall?: (x: number, y: number) => void;
        __e2eTickHoles?: () => void;
      };
      w.__e2ePlaceBall?.(px, py);
      w.__e2eTickHoles?.();
    },
    { px: TRAP.cx + innerTrapR * 0.7, py: TRAP.cy }
  );
  const st = await page.evaluate((maxR) => {
    const w = window as unknown as {
      __e2eHoleState?: () => { trapSinking: boolean; lastTriggerDist: number | null };
    };
    const s = w.__e2eHoleState?.();
    return { trapSinking: s?.trapSinking, lastTriggerDist: s?.lastTriggerDist };
  }, innerTrapR);
  expect(st?.trapSinking).toBe(true);
  expect(st!.lastTriggerDist!).toBeLessThanOrEqual(innerTrapR + 0.05);
});

test("E2E past: rychlý průlet mimo trigger — bez propadu", async ({ page }) => {
  await startHoleLevel(page);
  await page.evaluate(
    ({ x1, x2, y }) => {
      const w = window as unknown as {
        __e2ePlaceBall?: (x: number, y: number) => void;
        __e2eTickHoles?: () => void;
      };
      w.__e2ePlaceBall?.(x1, y);
      w.__e2eTickHoles?.();
      w.__e2ePlaceBall?.(x2, y);
      w.__e2eTickHoles?.();
    },
    { x1: TRAP.cx - 50, x2: TRAP.cx + 50, y: TRAP.cy }
  );
  const st = await page.evaluate(() => {
    const w = window as unknown as { __e2eHoleState?: () => { trapSinking: boolean; lastTriggerDist: number | null } };
    return w.__e2eHoleState?.();
  });
  expect(st?.trapSinking).toBe(false);
  expect(st?.lastTriggerDist).toBeNull();
});

test("E2E past: po propadu myší bez restart", async ({ page }) => {
  await startHoleLevel(page);
  await page.evaluate(
    ({ px, py }) => {
      const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void; __e2eTickHoles?: () => void };
      w.__e2ePlaceBall?.(px, py);
      w.__e2eTickHoles?.();
    },
    { px: TRAP.cx + innerTrapR * 0.85, py: TRAP.cy }
  );
  await sleep(400);
  const before = await page.evaluate(() => {
    const scene = (window as unknown as { __tiltMazeScene?: { ball?: { x: number } } }).__tiltMazeScene;
    const st = (window as unknown as { __e2eHoleState?: () => { ballStatic: boolean } }).__e2eHoleState?.();
    return { x: scene?.ball?.x ?? 0, static: st?.ballStatic ?? true };
  });
  expect(before.static).toBe(false);
  await driveMouseTilt(page, { nx: 1, ny: 0 }, 650);
  const afterX = await page.evaluate(() => (window as unknown as { __tiltMazeScene?: { ball?: { x: number } } }).__tiltMazeScene?.ball?.x ?? 0);
  expect(afterX).toBeGreaterThan(before.x + 2);
});

test("E2E: restart během propadu pasti", async ({ page }) => {
  await startHoleLevel(page);
  await page.evaluate(
    ({ px, py }) => {
      const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void; __e2eTickHoles?: () => void };
      w.__e2ePlaceBall?.(px, py);
      w.__e2eTickHoles?.();
    },
    { px: TRAP.cx + innerTrapR * 0.85, py: TRAP.cy }
  );
  await sleep(60);
  await page.getByRole("button", { name: "Restart" }).click();
  await sleep(150);
  const st = await page.evaluate(() => (window as unknown as { __e2eHoleState?: () => { trapSinking: boolean; ballStatic: boolean } }).__e2eHoleState?.());
  expect(st?.trapSinking).toBe(false);
  expect(st?.ballStatic).toBe(false);
});

test("E2E cíl: okraj bez výhry, trigger až v 0.25r", async ({ page }) => {
  await startHoleLevel(page);
  await page.evaluate(
    ({ px, py }) => {
      const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void; __e2eTickHoles?: () => void };
      w.__e2ePlaceBall?.(px, py);
      w.__e2eTickHoles?.();
    },
    { px: GOAL.cx + GOAL.r, py: GOAL.cy }
  );
  expect(await page.getByText("Výhra!", { exact: false }).isVisible()).toBe(false);

  await page.evaluate(
    ({ px, py }) => {
      const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void; __e2eTickHoles?: () => void };
      w.__e2ePlaceBall?.(px, py);
      w.__e2eTickHoles?.();
    },
    { px: GOAL.cx + innerGoalR * 0.85, py: GOAL.cy }
  );
  const st = await page.evaluate((maxR) => {
    const w = window as unknown as { __e2eHoleState?: () => { goalSettling: boolean; lastTriggerDist: number | null } };
    return w.__e2eHoleState?.();
  }, innerGoalR);
  expect(st?.goalSettling).toBe(true);
  expect(st?.lastTriggerDist).toBeLessThanOrEqual(innerGoalR + 0.05);

  await sleep(520);
  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 4000 });
});

test("E2E cíl: mezikruh + myš → výhra až u středu", async ({ page }) => {
  await startHoleLevel(page);
  await page.evaluate(
    ({ px, py }) => {
      const w = window as unknown as { __e2ePlaceBall?: (x: number, y: number) => void };
      w.__e2ePlaceBall?.(px, py);
    },
    { px: GOAL.cx, py: GOAL.cy + GOAL.r * 0.75 }
  );
  await sleep(150);
  expect(await page.getByText("Výhra!", { exact: false }).isVisible()).toBe(false);
  await driveMouseTilt(page, { nx: 0, ny: -1 }, 1400);
  await expect(page.getByText("Výhra!", { exact: false })).toBeVisible({ timeout: 8000 });
});
