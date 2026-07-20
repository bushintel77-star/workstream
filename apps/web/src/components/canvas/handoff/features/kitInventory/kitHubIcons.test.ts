import { describe, expect, it, beforeEach } from "vitest";
import {
  KIT_HUB_ICONS,
  kitHubIconById,
  loadKitHubIconId,
  saveKitHubIconId,
} from "./kitHubIcons";

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

describe("kitHubIcons", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("lists garden tool marks", () => {
    const ids = KIT_HUB_ICONS.map((i) => i.id);
    expect(ids).toContain("spade");
    expect(ids).toContain("fork");
    expect(ids).toContain("hammer");
  });

  it("persists click-to-keep choice", () => {
    expect(loadKitHubIconId()).toBe("spade");
    saveKitHubIconId("fork");
    expect(loadKitHubIconId()).toBe("fork");
    expect(kitHubIconById("fork").label).toBe("Fork");
  });
});
