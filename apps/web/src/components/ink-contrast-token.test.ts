import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.join(HERE, "..", "styles", "globals.css");

describe("Ink contrast token contract", () => {
  it("maps --ink-inverted to the white chip-ink token", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    expect(css).toMatch(
      /--ink-inverted:\s*var\(--ws-active-ink\);/,
    );
  });
});
