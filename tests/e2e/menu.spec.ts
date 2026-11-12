import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dismissSensorBannerIfPresent } from "./helpers/playwrightTilt";

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

  await expect(page.getByTestId("main-menu")).toBeHidden({ timeout: 10000 });
  await expect(page.locator("#tilt-maze-menu")).toBeHidden();
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();
  await expect(page.locator("#btn-menu")).toBeVisible();
  await page.locator("#btn-menu").click();

  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#tilt-maze-ui")).toHaveCount(0);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("E2E: desktop — karty úrovní kompaktní a v panelu", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("main-menu")).toBeVisible();

  const layout = await page.evaluate(() => {
    const menu = document.getElementById("tilt-maze-menu");
    const list = document.getElementById("tilt-maze-level-list");
    const card = list?.querySelector('button[data-level-index="0"]') as HTMLElement | null;
    if (!menu || !list || !card) return null;
    const menuR = menu.getBoundingClientRect();
    const listR = list.getBoundingClientRect();
    const cardR = card.getBoundingClientRect();
    const menuCenter = menuR.left + menuR.width / 2;
    const listCenter = listR.left + listR.width / 2;
    return {
      cardHeight: cardR.height,
      listCenterDelta: Math.abs(listCenter - menuCenter),
      listInsideMenu: listR.left >= menuR.left - 2 && listR.right <= menuR.right + 2
    };
  });

  expect(layout).not.toBeNull();
  expect(layout!.cardHeight).toBeLessThan(120);
  expect(layout!.listCenterDelta).toBeLessThan(24);
  expect(layout!.listInsideMenu).toBe(true);

  const groups = await page.locator(".tilt-maze-level-group").count();
  expect(groups).toBe(3);
  await expect(page.getByRole("heading", { name: /Bez pastí/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /S pastmi/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Lokální sklon/i })).toBeVisible();
  await assertLevelCardsNoTextOverflow(page);
});

async function assertLevelCardsNoTextOverflow(page: import("@playwright/test").Page) {
  const bad = await page.evaluate(() => {
    const buttons = document.querySelectorAll("#tilt-maze-level-list button[data-level-index]");
    const failures: string[] = [];
    buttons.forEach((btn) => {
      const el = btn as HTMLElement;
      const label = el.querySelector(".tilt-maze-level-card-label") as HTMLElement | null;
      if (el.scrollWidth > el.clientWidth + 1) {
        failures.push(`btn-${el.dataset.levelIndex}: scroll ${el.scrollWidth} > ${el.clientWidth}`);
      }
      if (label) {
        const br = el.getBoundingClientRect();
        const lr = label.getBoundingClientRect();
        const inset = 6;
        if (lr.right > br.right - inset || lr.left < br.left + inset || lr.bottom > br.bottom - inset) {
          failures.push(`label-${el.dataset.levelIndex}: mimo kartu`);
        }
      }
    });
    return failures;
  });
  expect(bad, bad.join("\n")).toEqual([]);
}

async function assertMenuWithinPlayfield(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("#game-container canvas") as HTMLCanvasElement | null;
      return (canvas?.getBoundingClientRect().width ?? 0) > 0;
    },
    { timeout: 10000 }
  );

  const result = await page.evaluate(() => {
    const canvas = document.querySelector("#game-container canvas") as HTMLCanvasElement | null;
    if (!canvas) return { outside: ["chybí canvas"], buildInPanel: null as boolean | null };
    const cb = canvas.getBoundingClientRect();
    const pad = 2;
    const panel = {
      left: cb.x + pad,
      top: cb.y + pad,
      right: cb.x + cb.width - pad,
      bottom: cb.y + cb.height - pad
    };

    const inside = (r: DOMRect) =>
      r.left >= panel.left && r.right <= panel.right && r.top >= panel.top && r.bottom <= panel.bottom;

    const targets: { label: string; el: Element | null }[] = [
      { label: "header", el: document.querySelector("#tilt-maze-menu header") },
      { label: "levels-label", el: document.getElementById("tilt-maze-levels-label") },
      { label: "level-list", el: document.getElementById("tilt-maze-level-list") },
      { label: "play", el: document.getElementById("menu-btn-play") },
      { label: "help", el: document.getElementById("menu-btn-help") },
      { label: "hint", el: document.querySelector("#tilt-maze-menu > p") }
    ];

    document.querySelectorAll("#tilt-maze-level-list button").forEach((btn, i) => {
      targets.push({ label: `level-${i}`, el: btn });
    });

    const outside: string[] = [];
    for (const t of targets) {
      if (!t.el) {
        outside.push(`chybí: ${t.label}`);
        continue;
      }
      if (!inside(t.el.getBoundingClientRect())) outside.push(t.label);
    }

    const buildEl = document.getElementById("tilt-maze-build-info");
    const buildInPanel = buildEl ? inside(buildEl.getBoundingClientRect()) : null;

    return { outside, buildInPanel, panel: { w: cb.width, h: cb.height, x: cb.x, y: cb.y } };
  });

  expect(result.outside, JSON.stringify(result)).toEqual([]);
  expect(result.buildInPanel, "build info má být mimo panel").toBe(false);
}

for (const viewport of [
  { name: "desktop 1280×800", width: 1280, height: 800 },
  { name: "mobile 390×844", width: 390, height: 844 }
]) {
  test(`E2E: menu uvnitř hracího panelu — ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${basePath}?e2e=1`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("main-menu")).toBeVisible();
    await assertMenuWithinPlayfield(page);
    await assertLevelCardsNoTextOverflow(page);

    const actionPin = await page.evaluate(() => {
      const menu = document.getElementById("tilt-maze-menu");
      const help = document.getElementById("menu-btn-help");
      if (!menu || !help) return null;
      const mb = menu.getBoundingClientRect();
      const hb = help.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(menu).paddingBottom) || 0;
      return mb.bottom - hb.bottom - pad;
    });
    expect(actionPin).not.toBeNull();
    expect(actionPin!).toBeLessThan(4);

    const slug = viewport.width >= 1000 ? "1280x800" : "390x844";
    await fs.promises.mkdir("/opt/cursor/artifacts", { recursive: true });
    await page.screenshot({
      path: `/opt/cursor/artifacts/menu-${slug}.png`,
      fullPage: false
    });
  });
}

test("E2E: návrat do menu vypne režim myši", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "domcontentloaded" });
  await page.locator("#menu-btn-play").click();
  await expect(page.locator("#tilt-maze-ui")).toBeVisible();
  await page.getByRole("button", { name: "Myš", exact: true }).click();
  await expect(page.locator("#tilt-maze-mouse-overlay")).toBeVisible();
  await page.locator("#btn-menu").click();
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
  await dismissSensorBannerIfPresent(page);
  await page.locator("#menu-btn-play").click();
  await expect(page.locator("#tilt-maze-mouse-overlay")).toBeHidden();
});

test("E2E: nápověda senzorů v menu", async ({ page }) => {
  await page.goto(`${basePath}?e2e=1`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });
  await page.locator("#menu-btn-help").click();
  await expect(page.getByTestId("help-overlay")).toBeVisible();
  await expect(page.getByTestId("help-overlay").getByText("Ovládání myší", { exact: false })).toBeVisible();
  await expect(page.getByTestId("help-overlay").getByText("červeným pastem", { exact: false })).toHaveCount(0);

  const fonts = await page.evaluate(() => {
    const card = document.querySelector("#tilt-maze-help > div");
    const menu = document.getElementById("tilt-maze-menu");
    if (!card || !menu) return null;
    return {
      help: getComputedStyle(card).fontFamily,
      menu: getComputedStyle(menu).fontFamily
    };
  });
  expect(fonts).not.toBeNull();
  expect(fonts!.help).toBe(fonts!.menu);
  await page.locator("#help-btn-close").click();
  await expect(page.getByTestId("help-overlay")).toHaveCount(0);
});
