import { defineConfig, devices } from "@playwright/test";

/**
 * Default to localhost. A shell env with PLAYWRIGHT_BASE_URL pointed at
 * Railway production must not silently hijack local gate runs — set
 * LIVE_E2E=1 to opt into remote base URLs.
 */
const LIVE = process.env.LIVE_E2E === "1";
// Prefer 127.0.0.1 — Node/Windows often resolve `localhost` to ::1 while
// the API binds IPv4 only (ECONNREFUSED ::1:3001 in e2e helpers).
const API_URL = LIVE
  ? (process.env.API_URL ?? "http://127.0.0.1:3001")
  : (process.env.API_URL ?? "http://127.0.0.1:3001");
const WEB_URL = LIVE
  ? (process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002")
  : (process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  // Cap actionability waits — a disabled/missing control must not burn the
  // full test timeout twice (retry) and look like a CI "hang".
  expect: { timeout: 12_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: process.env.CI ? 20_000 : 0,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: LIVE
    ? undefined
    : [
        {
          command:
            "pnpm exec turbo run build --filter=@workstream/api... && pnpm --filter @workstream/api exec tsx src/server.ts",
          url: `${API_URL}/healthz`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: {
            AUTH_REQUIRED: "false",
            NODE_ENV: "test",
            // E2E creates and exercises many projects from one loopback IP.
            // Keep production throttling enabled, but prevent test-order failures.
            RATE_LIMIT_MAX: "10000",
          },
        },
        {
          command: "pnpm --filter @workstream/web dev",
          url: WEB_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: {
            AUTH_REQUIRED: "false",
            API_URL,
            NEXT_PUBLIC_API_URL: API_URL,
            // Skip the studio's quiet Vicmap auto-trace — specs seed their own
            // state and the live WFS round-trips would blow test budgets.
            NEXT_PUBLIC_E2E: "1",
          },
        },
      ],
});
