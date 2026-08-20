/*
 * cfz.contract.test.ts — doc → code drift safety for the contract.
 *
 * Reads the canonical "Files in this contract" table in
 * docs/CANVAS-FIRST-Z-STACK-CONTRACT.md, extracts the file paths,
 * and asserts each exists on disk. If the contract doc references a
 * file that has been renamed/moved/deleted, this test fails fast
 * — the operator reading the doc sees a stale path, but the doc
 * itself claims authority. Better to make the doc and the repo agree.
 *
 * Plus: probes CanvasFirstLayout.tsx for the JSDoc "see also" link
 * anchors the canonical doc references. If those go missing, future
 * maintainers lose the contract doc trail.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// paths relative to the project root (vitest cwd)
// HERE = apps/web/src/components/canvas/cfz.contract.test.ts
//         1 = components/  2 = src/  3 = web/  4 = apps/  5 = workstream root
const ROOT = path.join(HERE, "..", "..", "..", "..", "..");
const DOC_PATH = path.join(ROOT, "docs", "CANVAS-FIRST-Z-STACK-CONTRACT.md");
const LAYOUT_PATH = path.join(
  ROOT,
  "apps/web/src/components/canvas/webgl/CanvasFirstLayout.tsx",
);
const CFZ_PATH = path.join(
  ROOT,
  "apps/web/src/components/canvas/cfz.ts",
);

/** Strip the markdown pipe-table to a flat list of file paths. */
function parseContractFiles(doc: string): string[] {
  // Find the section "Files in this contract". The heading is
  // "## N. Files in this contract" (any section number); we look for
  // the phrase anywhere, then snap to the line containing it.
  const start = doc.indexOf("Files in this contract");
  if (start < 0) {
    throw new Error("Contract doc is missing the 'Files in this contract' section.");
  }
  // Walk forward until the heading AT or AFTER `start` is found.
  // The heading is on its own line; we slice into the file from there.
  const headingMatch = /^##\s+\d+\.\s+Files in this contract/m.exec(
    doc.slice(start),
  );
  const headingStart = headingMatch
    ? start + (headingMatch.index ?? 0)
    : start;
  const tail = doc.slice(headingStart);
  const rows = tail.split("\n").slice(1); // drop the heading line
  const out: string[] = [];
  for (const row of rows) {
    // Stop only on next section heading. Empty / prose lines are
    // tolerated inside the section (intro paragraphs, etc.).
    if (/^##\s/.test(row)) break;
    if (!row.startsWith("|")) continue;
    const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    // First data cell is the file path; second is the role description.
    const pathCell = cells[0] ?? "";
    // Skip the table header (first cell is literal "File") and the
    // markdown separator row (cells are "---").
    if (pathCell === "File" || pathCell.startsWith("---")) continue;
    out.push(pathCell);
  }
  return out;
}  /** Sloppy but tolerant colon-trim; markdown italics can quote paths. */
function normalizeFilePath(raw: string): string {
  return raw.replace(/`/g, "").replace(/^\*\*|\*\*$/g, "").trim();
}

describe("cfz contract — doc ↔ filesystem", () => {
  it("every file listed in 'Files in this contract' maps to a real file on disk", () => {
    const doc = readFileSync(DOC_PATH, "utf8");
    const files = parseContractFiles(doc).map(normalizeFilePath);
    expect(files.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const file of files) {
      if (file.startsWith("`")) continue; // skip code-quoted placeholders
      if (!file.match(/^[A-Za-z0-9_./-]+$/)) continue; // skip prose
      const abs = path.join(ROOT, file);
      if (!existsSync(abs)) missing.push(file);
    }

    expect(
      missing,
      `Contract doc references ${missing.length} file(s) that do not exist:\n  ${missing.join("\n  ")}\n\n` +
        `Either restore the file or update docs/CANVAS-FIRST-Z-STACK-CONTRACT.md § "Files in this contract".`,
    ).toEqual([]);
  });

  it("the JSDoc in CanvasFirstLayout.tsx references the contract doc and cfz.ts", () => {
    const layout = readFileSync(LAYOUT_PATH, "utf8");

    expect(
      layout,
      "CanvasFirstLayout.tsx JSDoc must link to the contract doc so readers find §4 migration recipe.",
    ).toContain("CANVAS-FIRST-Z-STACK-CONTRACT.md");

    expect(
      layout,
      "CanvasFirstLayout.tsx JSDoc must reference the cfz.ts helper so feature modules find the JS reader.",
    ).toMatch(/cfz\.ts/);

    // Specifically the "See also" block we added during the upgrade.
    expect(layout).toMatch(/See also:[\s\S]*?CANVAS-FIRST-Z-STACK-CONTRACT\.md/);
    expect(layout).toMatch(/See also:[\s\S]*?\.\.\/cfz\.ts/);
  });

  it("the cfz.ts helper itself references the contract doc", () => {
    const cfz = readFileSync(CFZ_PATH, "utf8");
    expect(
      cfz,
      "cfz.ts must refer to the contract doc so the source code points at the upgrade path.",
    ).toContain("CANVAS-FIRST-Z-STACK-CONTRACT.md");
  });
});
