import { defineConfig, devices } from "@playwright/test";

const basePath = (process.env.E2E_BASE_PATH ?? "/tilt-maze/").replace(/\/?$/, "/");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: `http://127.0.0.1:4173${basePath}`,
    env: {
      ...process.env,
      VITE_BASE_PATH: basePath,
      VITE_IS_PR_PREVIEW: process.env.VITE_IS_PR_PREVIEW ?? "false",
      VITE_DISABLE_PWA: process.env.VITE_DISABLE_PWA ?? "false"
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "off"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
