import { test as base, expect, type CDPSession } from "@playwright/test";
import { clearCdpTilt } from "./helpers/playwrightTilt";

/**
 * Per-test CDP orientation cleanup so refresh timers and overrides cannot leak
 * across specs in the single worker CI uses (workers: 1).
 * Set `E2E_CPU_THROTTLE` (e.g. 6) to reproduce CI trace/slow-browser timing locally.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await clearCdpTilt(page);
    const throttle = Number(process.env.E2E_CPU_THROTTLE ?? 0);
    let cdp: CDPSession | undefined;
    if (throttle > 1) {
      cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
    }
    await use(page);
    if (cdp) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => undefined);
    await clearCdpTilt(page);
  }
});

export { expect };