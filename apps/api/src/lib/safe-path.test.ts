import { describe, expect, it } from "vitest";
import { audioFilePath } from "./storage";
import { containedPath, safeFileSegment } from "./safe-path";

describe("safeFileSegment", () => {
  it("accepts plain filenames", () => {
    expect(safeFileSegment("rec_abc123.m4a")).toBe("rec_abc123.m4a");
    expect(safeFileSegment("a")).toBe("a");
  });

  it("rejects traversal, separators, and control input", () => {
    expect(safeFileSegment("../evil")).toBeNull();
    expect(safeFileSegment("..")).toBeNull();
    expect(safeFileSegment(".")).toBeNull();
    expect(safeFileSegment("a/b")).toBeNull();
    expect(safeFileSegment("a\\b")).toBeNull();
    expect(safeFileSegment("a\0b")).toBeNull();
    expect(safeFileSegment("")).toBeNull();
    expect(safeFileSegment("dir/")).toBeNull();
  });
});

describe("containedPath", () => {
  const root = process.platform === "win32" ? "C:\\data\\uploads" : "/data/uploads";

  it("returns the resolved path for contained children", () => {
    const p = containedPath(root, "rec_1.m4a");
    expect(p).toBeTruthy();
    expect(p!.startsWith(root)).toBe(true);
  });

  it("rejects segments that escape the root", () => {
    expect(containedPath(root, "..", "etc", "passwd")).toBeNull();
    expect(containedPath(root, "sub/../../elsewhere")).toBeNull();
    expect(containedPath(root)).toBeNull(); // the root itself is never a file
  });
});

describe("audioFilePath containment", () => {
  it("builds the upload path for a store-generated id", () => {
    expect(audioFilePath("rec_abc", "https://x/uploads/rec_abc.m4a")).toContain(
      "rec_abc.m4a",
    );
  });

  it("throws on a doctored recording id instead of escaping the uploads dir", () => {
    expect(() => audioFilePath("../evil", "https://x/uploads/x.webm")).toThrow();
    expect(() => audioFilePath("a/b", "https://x/uploads/x.m4a")).toThrow();
  });
});
