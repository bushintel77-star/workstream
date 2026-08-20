/*
 * CfzTierInspector.gate.test.ts — production safety story for the HUD.
 *
 * The CfzTierInspector HUD is gated by:
 *   1. typeof window !== "undefined" (no SSR mount)
 *   2. process.env.NODE_ENV !== "production"
 *   3. URL flag presence (?cfz-inspect=1 OR ?cfz-peel=1)
 *
 * Without these gates, a future contributor could remove the NODE_ENV
 * check, ship the dev tool to prod, and leak operator affordances into
 * the user-facing surface. This test pins every combination so any
 * regression fails fast.
 *
 * Tests run in node environment (no jsdom) — the gate logic exercises
 * globalThis.window + process.env directly. We stub both via
 * vi.stubGlobal + vi.stubEnv per scenario.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/** Build a stubbed window with the given URL search params. */
function stubWindow(search: string) {
  const url = search.startsWith("?") ? search : `?${search}`;
  // Use a plain object — URLSearchParams only reads `search` from
  // window.location, no other properties are touched.
  vi.stubGlobal("window", { location: { search: url } });
}

beforeEach(() => {
  // Default: development env, no URL flag. Each test overrides.
  vi.stubEnv("NODE_ENV", "development");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("CfzTierInspector — production safety gate", () => {
  it("NODE_ENV=production blocks the inspect HUD even when ?cfz-inspect=1 is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubWindow("?cfz-inspect=1");
    const { readQueryFlag, readPeelFlag } = await import("./CfzTierInspector");
    expect(readQueryFlag()).toBe(false);
    expect(readPeelFlag()).toBe(false);
  });

  it("NODE_ENV=production blocks the peel bar even when ?cfz-peel=1 is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubWindow("?cfz-peel=1");
    const { readQueryFlag, readPeelFlag } = await import("./CfzTierInspector");
    expect(readQueryFlag()).toBe(false);
    expect(readPeelFlag()).toBe(false);
  });

  it("NODE_ENV=development + ?cfz-inspect=1 enables only the inspect HUD", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubWindow("?cfz-inspect=1");
    const { readQueryFlag, readPeelFlag } = await import("./CfzTierInspector");
    expect(readQueryFlag()).toBe(true);
    expect(readPeelFlag()).toBe(false);
  });

  it("NODE_ENV=development + ?cfz-peel=1 enables only the peel bar", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubWindow("?cfz-peel=1");
    const { readQueryFlag, readPeelFlag } = await import("./CfzTierInspector");
    expect(readQueryFlag()).toBe(false);
    expect(readPeelFlag()).toBe(true);
  });

  it("NODE_ENV=development + both flags enables both panels independently", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubWindow("?cfz-inspect=1&cfz-peel=1");
    const { readQueryFlag, readPeelFlag } = await import("./CfzTierInspector");
    expect(readQueryFlag()).toBe(true);
    expect(readPeelFlag()).toBe(true);
  });

  it("NODE_ENV=development without any URL flag keeps the HUD silent", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubWindow("");
    const { readQueryFlag, readPeelFlag } = await import("./CfzTierInspector");
    expect(readQueryFlag()).toBe(false);
    expect(readPeelFlag()).toBe(false);
  });

  it("a non-'1' value for the URL flag does not enable the HUD (strict equality, not presence)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubWindow("?cfz-inspect=true&cfz-peel=yes");
    const { readQueryFlag, readPeelFlag } = await import("./CfzTierInspector");
    expect(readQueryFlag()).toBe(false);
    expect(readPeelFlag()).toBe(false);
  });

  it("with no window (SSR), both flags are forced false regardless of env", async () => {
    vi.stubEnv("NODE_ENV", "development");
    // Drop the window stub — typeof window becomes "undefined".
    vi.stubGlobal("window", undefined);
    const { readQueryFlag, readPeelFlag } = await import("./CfzTierInspector");
    expect(readQueryFlag()).toBe(false);
    expect(readPeelFlag()).toBe(false);
  });
});
