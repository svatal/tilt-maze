import type { Page } from "@playwright/test";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
