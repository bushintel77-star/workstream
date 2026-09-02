import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-pass-only config. Servers are expected to be ALREADY RUNNING:
 *   API  http://127.0.0.1:3101  (Workstream API, PORT=3101)
 *   Web  http://127.0.0.1:3002  (next dev, started WITHOUT NEXT_PUBLIC_E2E
 *                               so the guided handoff / scale toggle / loader
 *                               are live — the real CI e2e/ config sets
 *                               NEXT_PUBLIC_E2E=1 and would disable them).
 */
export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3002",
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions: { args: [] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
