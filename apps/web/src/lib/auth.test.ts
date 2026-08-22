import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthRequired } from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAuthRequired", () => {
  it("honors AUTH_REQUIRED=false as an explicit production bootstrap override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_REQUIRED", "false");
    expect(isAuthRequired()).toBe(false);
  });

  it("requires auth by default in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_REQUIRED", undefined);
    expect(isAuthRequired()).toBe(true);
  });

  it("requires auth when AUTH_REQUIRED=true in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_REQUIRED", "true");
    expect(isAuthRequired()).toBe(true);
  });

  it("honors the explicit flag outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_REQUIRED", "true");
    expect(isAuthRequired()).toBe(true);
    vi.stubEnv("AUTH_REQUIRED", "false");
    expect(isAuthRequired()).toBe(false);
  });
});
