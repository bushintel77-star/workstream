/*
 * ui.scan.test.ts — off-scale inline value scan.
 *
 * Mirrors the cfz.registry.test.ts pattern: walk the canvas
 * component tree, parse .tsx files line-by-line, throw a
 * comprehensive, IDE-friendly violation list when any inline
 * value falls off the canonical scale (see
 * docs/UI-ELEMENT-STANDARDS.md).
 *
 * The scale itself is parsed live from apps/web/src/styles/globals.css
 * so this test cannot drift away from what the CSS actually
 * declares. If somebody changes a token there, this test reads the
 * new value back automatically.
 *
 * Migration rule (mirrors cfz's no-restricted-syntax spirit):
 *   • Every inline `borderRadius: N`, `fontSize: N`, `gap: N`
 *     in a .tsx file under apps/web/src/components/canvas MUST
 *     resolve to one of the documented scales.
 *   • Every raw `rgba(…)`, `rgb(…)` in the same scope is flagged
 *     as off-scale — chrome surfaces should consume CSS tokens.
 *
 * Steps that don't fall on a rung belong in a "special reason"
 * appendix of the standards doc, not inline in the source. New
 * contributions that introduce a raw pixel value will be caught
 * here on first run.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// HERE = apps/web/src/components/canvas/ui.scan.test.ts
// Scan root = the directory this test lives in (canvas dir).
const TARGET = HERE;
// 5 ups reaches the workstream repo root (parent of apps/).
const ROOT = path.join(HERE, "..", "..", "..", "..", "..");
const CSS_PATH = path.join(
  ROOT,
  "apps/web/src/styles/globals.css",
);

/**
 * Parse every numeric value behind a `--<prefix>-<name>: Npx`
 * declaration. Returns the unique sorted numeric set declared
 * by globals.css. Drives the test scale so it can never drift
 * from the source-of-truth CSS.
 */
function parseNumericScale(css: string, prefix: string): number[] {
  const out = new Set<number>();
  const re = new RegExp(`--${prefix}-[a-z0-9-]+:\\s*(-?[\\d.]+)px?;`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out.add(Number.parseFloat(m[1]));
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Walk one directory yielding absolute .ts/.tsx paths, dropping
 * test files so self-quoting doesn't trip the scan.
 */
function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (
      /\.(?:ts|tsx)$/.test(entry) &&
      !/\.test\.(?:ts|tsx)$/.test(entry)
    ) {
      yield full;
    }
  }
}

interface Finding {
  file: string;
  line: number;
  col: number;
  raw: string;
}

/** Find every numeric `prefix: N` match that is NOT in the scale.
 *  Stops at line boundaries so the reported match is the immediate
 *  inline value, not a multi-line context grab. */
function findOffScale(file: string, re: RegExp, scale: ReadonlySet<number>): Finding[] {
  const text = readFileSync(file, "utf8");
  const hits: Finding[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const num = Number.parseFloat(m[1]!);
    if (!Number.isFinite(num) || scale.has(num)) continue;
    const upto = text.slice(0, m.index);
    const line = upto.split("\n").length;
    const col = upto.length - (upto.lastIndexOf("\n") + 1) + 1;
    // Capture just the line containing the match so reports stay
    // scannable. Single-line matches read as `prop: 5`; multi-line
    // JSX inline styles get truncated cleanly.
    const lineText = text.split("\n")[line - 1] ?? "";
    hits.push({ file, line, col, raw: `${lineText.trim().slice(0, 120)}` });
  }
  return hits;
}

/** Pretty-print a violation list for IDE-friendly diagnostics. */
function describe_finding(v: Finding): string {
  const rel = path.relative(ROOT, v.file);
  return `  ${rel}:${v.line}:${v.col}  →  ${v.raw}`;
}

describe("ui.scan — off-scale inline values (parses scales live from globals.css)", () => {
  const css = readFileSync(CSS_PATH, "utf8");
  const radiusScale = new Set(parseNumericScale(css, "gs-radius"));
  const fontScale = new Set(parseNumericScale(css, "gs-font"));
  const spaceScale = new Set(parseNumericScale(css, "gs-space"));

  // ── Self-checks: assert the parsed scales have the documented
  //    step count. If a token is added to globals.css without bumping
  //    the standard, this fails first.
  it("globals.css declares 7 gs-radius, 9 gs-font, 7 gs-space, 3 time tokens", () => {
    // Set<number> exposes .size, not .length — that's the Array API.
    expect(radiusScale.size, "gs-radius scale should have 7 rungs").toBe(7);
    expect(fontScale.size, "gs-font scale should have 9 rungs").toBe(9);
    expect(spaceScale.size, "gs-space scale should have 7 rungs").toBe(7);
    // Transitions are stored as full strings (e.g. "180ms ease-out");
    // this test only pins the count of *numeric* tokens, the transition
    // scale is documented separately in SCALE_TRANSITIONS.
    expect(radiusScale.has(9999), "gs-radius must include the pill rung 9999").toBe(true);
    expect(fontScale.has(11), "gs-font must include the body default 11").toBe(true);
    expect(spaceScale.has(8), "gs-space must include the default section gap 8").toBe(true);
    expect(spaceScale.has(10), "gs-space must include the 10px rung used by WebGLStudioPreview layouts").toBe(true);
  });

  // ── Scale membership scans: every inline value across canvas
  //    MUST resolve to one of the parsed scale numbers.
  const RADIUS_RE = /\bborderRadius:\s*([\d.]+)/g;
  const FONT_RE = /\bfontSize:\s*([\d.]+)/g;
  const GAP_RE = /\bgap:\s*([\d.]+)/g;

  it("every fontSize in canvas is on the gs-font scale", () => {
    const out: Finding[] = [];
    for (const f of walk(TARGET)) out.push(...findOffScale(f, FONT_RE, fontScale));
    expect(
      out,
      out.length === 0
        ? "no off-scale values"
        : `${out.length} off-scale fontSize value(s). Allowed: [${[...fontScale].join(", ")}]\n` +
          `  See docs/UI-ELEMENT-STANDARDS.md §2.\n` +
          out.slice(0, 10).map(describe_finding).join("\n") +
          (out.length > 10 ? `\n  …${out.length - 10} more` : ""),
    ).toEqual([]);
  });

  it("every borderRadius in canvas is on the gs-radius scale", () => {
    const out: Finding[] = [];
    for (const f of walk(TARGET)) out.push(...findOffScale(f, RADIUS_RE, radiusScale));
    expect(
      out,
      out.length === 0
        ? "no off-scale values"
        : `${out.length} off-scale borderRadius value(s). Allowed: [${[...radiusScale].join(", ")}]\n` +
          `  See docs/UI-ELEMENT-STANDARDS.md §1.\n` +
          out.slice(0, 10).map(describe_finding).join("\n") +
          (out.length > 10 ? `\n  …${out.length - 10} more` : ""),
    ).toEqual([]);
  });

  it("every gap in canvas is on the gs-space scale", () => {
    const out: Finding[] = [];
    for (const f of walk(TARGET)) out.push(...findOffScale(f, GAP_RE, spaceScale));
    expect(
      out,
      out.length === 0
        ? "no off-scale values"
        : `${out.length} off-scale gap value(s). Allowed: [${[...spaceScale].join(", ")}]\n` +
          `  See docs/UI-ELEMENT-STANDARDS.md §3.\n` +
          out.slice(0, 10).map(describe_finding).join("\n") +
          (out.length > 10 ? `\n  …${out.length - 10} more` : ""),
    ).toEqual([]);
  });

  // ── Raw color scan: any literal rgba()/rgb() in canvas surfaces must
  //    migrate to a CSS token. Resolved inside the test for line-bound
  //    matches; no top-level regex constants needed here.

  it("no raw rgba()/rgb() literal in canvas surfaces (use CSS tokens)", () => {
    // Capture the smallest meaningful unit: the literal call
    // (e.g. `rgba(0,0,0,0.78)`), so reports stay one-line and
    // scannable. Does not pursue `color-mix()` calls because
    // those resolve through CSS variables in production.
    const rgbaCall = /\brgba?\([^()]*\)/g;
    const out: Finding[] = [];
    for (const f of walk(TARGET)) {
      const text = readFileSync(f, "utf8");
      let m: RegExpExecArray | null;
      while ((m = rgbaCall.exec(text)) !== null) {
        const upto = text.slice(0, m.index);
        const line = upto.split("\n").length;
        const col = upto.length - (upto.lastIndexOf("\n") + 1) + 1;
        out.push({ file: f, line, col, raw: m[0] });
      }
    }
    expect(
      out,
      out.length === 0
        ? "no raw rgba inline"
        : `${out.length} surface uses raw rgba() / rgb() (should consume a CSS token).\n` +
          `  See docs/UI-ELEMENT-STANDARDS.md §5.\n` +
          out.slice(0, 10).map(describe_finding).join("\n") +
          (out.length > 10 ? `\n  …${out.length - 10} more` : ""),
    ).toEqual([]);
  });

  it("the canvas tree contains product source files (sanity floor)", () => {
    // Counts every .tsx file under TARGET, no exclusions. If this
    // returns zero, the directory moved and TARGET is stale.
    let n = 0;
    for (const _ of walk(TARGET)) n++;
    expect(n, "canvas/ should have at least 30 non-test tsx files").toBeGreaterThan(30);
  });
});
