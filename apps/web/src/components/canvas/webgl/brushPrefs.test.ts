import { afterEach, describe, expect, it } from "vitest";
import {
  readBrushPrefs,
  sanitizeBrushPrefs,
  writeBrushPrefs,
} from "./brushPrefs";

/**
 * Tier-1 brush state persistence — the storage seam behind handover §4.5
 * ("session persistence of last nib/colour/width per project").
 *
 * The repo tests in pure node (no jsdom), so the suite installs an
 * in-memory Storage on globalThis — the same surface the production guards
 * branch on (`typeof sessionStorage === "undefined"` on the server, where
 * the calls must silently no-op).
 */

interface MemoryStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function installMemoryStorage(): Map<string, string> {
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).sessionStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  } satisfies MemoryStorage;
  return map;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).sessionStorage;
});

describe("sanitizeBrushPrefs — stored JSON is never trusted wholesale", () => {
  it("keeps canon nibs, known materials, and in-range numbers", () => {
    const prefs = sanitizeBrushPrefs({
      nib: "ink-03",
      materialId: "corten",
      widthPx: 6,
      opacity: 0.4,
    });
    expect(prefs).toEqual({
      nib: "ink-03",
      materialId: "corten",
      widthPx: 6,
      opacity: 0.4,
    });
  });

  it("preserves explicit nulls (the nib-default escape)", () => {
    const prefs = sanitizeBrushPrefs({
      nib: "graphite-6b",
      materialId: null,
      widthPx: null,
      opacity: null,
    });
    expect(prefs).toEqual({
      nib: "graphite-6b",
      materialId: null,
      widthPx: null,
      opacity: null,
    });
  });

  it("drops unknown nibs, unknown materials, and out-of-range numbers", () => {
    const prefs = sanitizeBrushPrefs({
      nib: "magic-marker",
      materialId: "unobtanium",
      widthPx: 400,
      opacity: 12,
    });
    expect(prefs).toEqual({});
  });

  it("drops non-numeric garbage and non-object payloads", () => {
    expect(sanitizeBrushPrefs({ widthPx: "thick", opacity: NaN })).toEqual({});
    expect(sanitizeBrushPrefs("graphite-6b")).toEqual({});
    expect(sanitizeBrushPrefs(null)).toEqual({});
  });
});

describe("read/write round-trip (session storage)", () => {
  it("restores what was written, per project key", () => {
    const store = installMemoryStorage();
    writeBrushPrefs("p1", {
      nib: "chisel-marker",
      materialId: "moss",
      widthPx: 12,
      opacity: 0.8,
    });
    expect([...store.keys()]).toEqual(["ws-brush-prefs:p1"]);
    expect(readBrushPrefs("p1")).toEqual({
      nib: "chisel-marker",
      materialId: "moss",
      widthPx: 12,
      opacity: 0.8,
    });
    // Projects are isolated — p2 has nothing saved.
    expect(readBrushPrefs("p2")).toBeNull();
  });

  it("returns null for empty project ids, missing keys, and corrupt JSON", () => {
    installMemoryStorage();
    expect(readBrushPrefs("")).toBeNull();
    expect(readBrushPrefs("p1")).toBeNull();
    (globalThis as unknown as { sessionStorage: MemoryStorage }).sessionStorage.setItem(
      "ws-brush-prefs:p1",
      "{not json",
    );
    expect(readBrushPrefs("p1")).toBeNull();
  });

  it("silently no-ops without a storage backend (SSR / pure node)", () => {
    // No install — sessionStorage is undefined on globalThis.
    expect(() => writeBrushPrefs("p1", { nib: "ink-03" })).not.toThrow();
    expect(readBrushPrefs("p1")).toBeNull();
  });
});
