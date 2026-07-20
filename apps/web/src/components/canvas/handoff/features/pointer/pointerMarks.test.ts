import { describe, expect, it, beforeEach } from "vitest";
import {
  POINTER_MARKS,
  loadPointerMarkId,
  pointerMarkById,
  pointerMarkCursor,
  savePointerMarkId,
} from "./pointerMarks";

function mockLocalStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
}

describe("pointerMarks", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("lists garden craft marks for the cursor", () => {
    const ids = POINTER_MARKS.map((i) => i.id);
    expect(ids).toContain("spade");
    expect(ids).toContain("fork");
    expect(ids).toContain("hammer");
  });

  it("persists click-to-keep choice", () => {
    expect(loadPointerMarkId()).toBe("spade");
    savePointerMarkId("fork");
    expect(loadPointerMarkId()).toBe("fork");
    expect(pointerMarkById("fork").label).toBe("Fork");
  });

  it("migrates legacy kit-hub key", () => {
    localStorage.setItem("ws-kit-hub-icon", "rake");
    expect(loadPointerMarkId()).toBe("rake");
  });

  it("builds a CSS cursor url", () => {
    expect(pointerMarkCursor("spade")).toContain("data:image/svg+xml");
    expect(pointerMarkCursor("spade")).toContain("crosshair");
  });
});
