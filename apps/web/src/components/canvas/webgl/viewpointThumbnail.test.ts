import { describe, it, expect, vi } from "vitest";
import {
  coverCropRect,
  renderViewpointThumbnail,
  THUMB_W,
  THUMB_H,
} from "./viewpointThumbnail";

// The pure cropper + renderer are tested here. The runtime wrapper
// (captureViewpointThumbnail) just calls renderViewpointThumbnail with a
// real document.createElement, which needs jsdom — the wrapper is thin enough
// to verify via the browser smoke test instead.

function makeMockSource(w: number, h: number) {
  return {
    width: w,
    height: h,
    getContext: () => ({ drawImage: vi.fn() }),
    toDataURL: vi.fn(() => "data:image/png;base64,MOCK"),
  };
}

function makeMockFactory() {
  return vi.fn(() => ({
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: vi.fn() }),
    toDataURL: vi.fn(() => "data:image/png;base64,MOCK"),
  }));
}

describe("coverCropRect", () => {
  it("returns null for zero-width source", () => {
    expect(coverCropRect(0, 1080, 82, 52)).toBeNull();
  });

  it("returns null for zero-height source", () => {
    expect(coverCropRect(1920, 0, 82, 52)).toBeNull();
  });

  it("crops horizontally for a wide source (16:9 → 82:52)", () => {
    const r = coverCropRect(1920, 1080, 82, 52);
    expect(r).not.toBeNull();
    expect(r!.sy).toBe(0);
    expect(r!.sh).toBe(1080);
    // sw = srcH * targetAspect = 1080 * (82/52) ≈ 1703.08
    expect(r!.sw).toBeCloseTo(1080 * (82 / 52), 1);
    // sx = (srcW - sw) / 2
    expect(r!.sx).toBeCloseTo((1920 - 1080 * (82 / 52)) / 2, 1);
  });

  it("crops vertically for a tall source (1:2 → 82:52)", () => {
    const r = coverCropRect(500, 1000, 82, 52);
    expect(r).not.toBeNull();
    expect(r!.sx).toBe(0);
    expect(r!.sw).toBe(500);
    // sh = srcW / targetAspect = 500 / (82/52) ≈ 317.07
    expect(r!.sh).toBeCloseTo(500 / (82 / 52), 1);
    expect(r!.sy).toBeCloseTo((1000 - 500 / (82 / 52)) / 2, 1);
  });

  it("returns full source for exact aspect match", () => {
    const r = coverCropRect(82, 52, 82, 52);
    expect(r).toEqual({ sx: 0, sy: 0, sw: 82, sh: 52 });
  });

  it("handles a square source (taller than 82:52)", () => {
    const r = coverCropRect(500, 500, 82, 52);
    expect(r).not.toBeNull();
    // Square is taller than 82:52, so crop vertically
    expect(r!.sx).toBe(0);
    expect(r!.sw).toBe(500);
  });
});

describe("renderViewpointThumbnail", () => {
  it("returns a data URL for a valid source", () => {
    const source = makeMockSource(1920, 1080);
    const factory = makeMockFactory();
    const result = renderViewpointThumbnail(source, factory);
    expect(result).toBe("data:image/png;base64,MOCK");
  });

  it("returns null for a zero-width source", () => {
    const source = makeMockSource(0, 1080);
    const factory = makeMockFactory();
    const result = renderViewpointThumbnail(source, factory);
    expect(result).toBeNull();
    expect(factory).not.toHaveBeenCalled();
  });

  it("returns null for a zero-height source", () => {
    const source = makeMockSource(1920, 0);
    const factory = makeMockFactory();
    const result = renderViewpointThumbnail(source, factory);
    expect(result).toBeNull();
  });

  it("returns null when the thumb canvas getContext returns null", () => {
    const source = makeMockSource(1920, 1080);
    const factory = vi.fn(() => ({
      width: 0,
      height: 0,
      getContext: () => null,
      toDataURL: vi.fn(),
    }));
    const result = renderViewpointThumbnail(source, factory);
    expect(result).toBeNull();
  });

  it("returns null when toDataURL throws (tainted canvas)", () => {
    const source = makeMockSource(1920, 1080);
    const factory = vi.fn(() => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: vi.fn(() => {
        throw new Error("SecurityError: tainted canvas");
      }),
    }));
    const result = renderViewpointThumbnail(source, factory);
    expect(result).toBeNull();
  });

  it("accepts custom dimensions", () => {
    const source = makeMockSource(800, 600);
    const factory = makeMockFactory();
    const result = renderViewpointThumbnail(source, factory, 100, 60);
    expect(result).toBe("data:image/png;base64,MOCK");
  });

  it("uses the default 82x52 dimensions", () => {
    expect(THUMB_W).toBe(82);
    expect(THUMB_H).toBe(52);
  });
});
