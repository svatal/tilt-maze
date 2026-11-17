import { test as base, expect } from "@playwright/test";
import { clearCdpTilt } from "./helpers/playwrightTilt";

/**
 * Per-test CDP orientation cleanup so refresh timers and overrides cannot leak
 * across specs in the single worker CI uses (workers: 1).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await clearCdpTilt(page);
    await use(page);
    await clearCdpTilt(page);
  }
});

export { expect };