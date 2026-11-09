import { expect, type Page } from "@playwright/test";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function startGameFromMenu(page: Page, levelIndex = 0): Promise<void> {
  await page.goto(`${(process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/")}?e2e=1`, {
    waitUntil: "domcontentloaded"
  });
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 15000 });
  await page.locator(`button[data-level-index="${levelIndex}"]`).click();
  await page.locator("#menu-btn-play").click();
  await expect(page.locator("#tilt-maze-ui")).toBeVisible({ timeout: 10000 });
}

/** Zapne režim Myš a drží kurzor v normalizovaném směru (−1…1) uvnitř canvasu. */
export async function driveMouseTilt(
  page: Page,
  dir: { nx: number; ny: number },
  holdMs = 600
): Promise<void> {
  await page.getByRole("button", { name: "Myš", exact: true }).click();
  const canvas = page.locator("#game-container canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Chybí canvas pro ovládání myší");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const scale = 0.42;
  await page.mouse.move(cx + (box.width / 2) * dir.nx * scale, cy + (box.height / 2) * dir.ny * scale);
  await sleep(holdMs);
}

/** Simuluje DeviceOrientation (E2E — prohlížeč nemá fyzický senzor). */
export async function dispatchDeviceOrientation(
  page: Page,
  beta: number,
  gamma = 0
): Promise<void> {
  await page.evaluate(
    ({ beta, gamma }) => {
      window.dispatchEvent(
        new DeviceOrientationEvent("deviceorientation", { beta, gamma, alpha: 0, absolute: false })
      );
    },
    { beta, gamma }
  );
  await sleep(80);
}
