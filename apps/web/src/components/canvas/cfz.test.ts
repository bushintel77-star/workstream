/*
 * cfz.test.ts — companion to apps/web/src/components/canvas/cfz.ts.
 *
 * Pins the documented SDS pair values under both paths the helper can take:
 *
 *   1. SSR / no-document — falls back to the static FALLBACK map.
 *   2. Hydration / mocked CSSOM — reads from getComputedStyle + caches.
 *
 * Also asserts the per-tier cache only triggers one CSSOM read per unique
 * tier, so per-frame drei re-renders never spam the document tree.
 *
 * Each `describe` resets the module registry so the module-level cache
 * inside cfz.ts starts empty in every scenario.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Build a stubbed CSSOM whose `getPropertyValue(name)` returns the
 * supplied map. Also stubs the global `getComputedStyle` so cfz's call
 * (`getComputedStyle(document.documentElement)`) hits the stub instead
 * of jsdom/Node's undefined implementation.
 */
function stubCssom(values: Record<string, string>) {
  const getPropertyValue = vi.fn((name: string) => values[name] ?? "");
  const getComputedStyle = vi.fn(() => ({ getPropertyValue }));
  vi.stubGlobal("document", { documentElement: {} });
  vi.stubGlobal("getComputedStyle", getComputedStyle);
  return { getPropertyValue, getComputedStyle };
}

describe("cfz — SSR fallback (no document)", () => {
  beforeEach(() => {
    vi.resetModules();
    // Force the typeof-document guard to fire by stubbing document to undefined.
    vi.stubGlobal("document", undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("readCfZ returns the documented SDS tokens under SSR", async () => {
    const { readCfZ } = await import("./cfz");
    expect(readCfZ("canvas")).toBe(0);
    expect(readCfZ("spatial")).toBe(10);
    expect(readCfZ("chrome")).toBe(20);
    expect(readCfZ("app")).toBe(30);
  });

  it("CF_Z_PAIRS resolves to the four documented pairs", async () => {
    const { CF_Z_PAIRS } = await import("./cfz");
    expect(CF_Z_PAIRS.spatialLabel).toEqual([10, 1]);
    expect(CF_Z_PAIRS.spatialAnnotation).toEqual([20, 10]);
    expect(CF_Z_PAIRS.chromeChip).toEqual([30, 15]);
    expect(CF_Z_PAIRS.chromeZone).toEqual([30, 20]);
  });

  it("cfZPair returns a fresh mutable tuple on every call", async () => {
    const { cfZPair } = await import("./cfz");
    const a = cfZPair("spatialAnnotation");
    const b = cfZPair("spatialAnnotation");
    expect(a).toEqual([20, 10]);
    expect(b).toEqual([20, 10]);
    // Tuple is plain [number, number] now (not readonly) — verifiable by mutation.
    expect(() => {
      (a as [number, number]).push(99);
    }).not.toThrow();
  });
});

describe("cfz — client path (mocked CSSOM)", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("readCfZ reads each tier from getComputedStyle exactly once", async () => {
    const { getPropertyValue } = stubCssom({
      "--cf-z-canvas": "0",
      "--cf-z-spatial": "10",
      "--cf-z-chrome": "20",
      "--cf-z-app": "30",
    });
    const { readCfZ } = await import("./cfz");

    expect(readCfZ("canvas")).toBe(0);
    expect(readCfZ("spatial")).toBe(10);
    expect(readCfZ("chrome")).toBe(20);
    expect(readCfZ("app")).toBe(30);

    // Four unique tiers → four CSSOM reads, in declaration order.
    expect(getPropertyValue).toHaveBeenCalledTimes(4);
    expect(getPropertyValue).toHaveBeenNthCalledWith(1, "--cf-z-canvas");
    expect(getPropertyValue).toHaveBeenNthCalledWith(2, "--cf-z-spatial");
    expect(getPropertyValue).toHaveBeenNthCalledWith(3, "--cf-z-chrome");
    expect(getPropertyValue).toHaveBeenNthCalledWith(4, "--cf-z-app");
  });

  it("repeated readCfZ calls hit the cache, NOT the CSSOM", async () => {
    const { getPropertyValue } = stubCssom({
      "--cf-z-canvas": "0",
      "--cf-z-spatial": "10",
      "--cf-z-chrome": "20",
      "--cf-z-app": "30",
    });
    const { readCfZ } = await import("./cfz");

    // First pass: seeds the cache → 4 reads.
    readCfZ("canvas");
    readCfZ("spatial");
    readCfZ("chrome");
    readCfZ("app");
    const baseline = getPropertyValue.mock.calls.length;
    expect(baseline).toBe(4);

    // Second pass: same tiers → zero additional reads.
    readCfZ("canvas");
    readCfZ("canvas");
    readCfZ("spatial");
    readCfZ("chrome");
    readCfZ("app");
    readCfZ("app");
    expect(getPropertyValue.mock.calls.length).toBe(baseline);
  });

  it("CF_Z_PAIRS picks up overrides from the CSSOM", async () => {
    stubCssom({
      "--cf-z-canvas": "7",
      "--cf-z-spatial": "13",
      "--cf-z-chrome": "23",
      "--cf-z-app": "33",
    });
    const { CF_Z_PAIRS } = await import("./cfz");

    // Computed from the documented expressions on the overrides.
    //   spatialLabel      = [spatial, canvas + 1]    = [13, 8]
    //   spatialAnnotation = [chrome,  spatial]       = [23, 13]
    //   chromeChip        = [app,     spatial + 5]   = [33, 18]
    //   chromeZone        = [app,     chrome]        = [33, 23]
    expect(CF_Z_PAIRS.spatialLabel).toEqual([13, 8]);
    expect(CF_Z_PAIRS.spatialAnnotation).toEqual([23, 13]);
    expect(CF_Z_PAIRS.chromeChip).toEqual([33, 18]);
    expect(CF_Z_PAIRS.chromeZone).toEqual([33, 23]);
  });

  it("falls back to FALLBACK when a tier's CSSOM read is unparseable", async () => {
    // Empty string from CSSOM → Number.parseInt returns NaN → FALLBACK wins.
    stubCssom({
      "--cf-z-canvas": "",
      "--cf-z-spatial": "",
      "--cf-z-chrome": "",
      "--cf-z-app": "",
    });
    const { readCfZ } = await import("./cfz");

    expect(readCfZ("canvas")).toBe(0);
    expect(readCfZ("spatial")).toBe(10);
    expect(readCfZ("chrome")).toBe(20);
    expect(readCfZ("app")).toBe(30);
  });
});
