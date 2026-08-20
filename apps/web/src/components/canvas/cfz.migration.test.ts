/*
 * cfz.migration.test.ts — recipe-mirror companion to cfz.migration.ts.
 *
 * Asserts the helper:
 *   1. Returns exactly the four documented surfaces.
 *   2. Each step points at the file the contract doc names.
 *   3. The recipe format prints to stdout (smoke test).
 *
 * Plus one "console" test that prints the recipe to stdout on dev runs
 * so a developer reading `pnpm test` output sees the upgrade path
 * without leaving the editor.
 */

import { describe, expect, it } from "vitest";

import {
  EXPECTED_LADDER_STEPS,
  describeLadder,
  formatMigrationRecipe,
  getTierBumpMigrationSteps,
} from "./cfz.migration";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

describe("cfz.migration — recipe mirror", () => {
  it("returns the same four steps as the contract doc §4", () => {
    expect([...EXPECTED_LADDER_STEPS]).toEqual(["css", "js", "lint", "runtime"]);
  });

  it("each step points at the file the contract doc names", () => {
    expect(getTierBumpMigrationSteps()).toMatchObject([
      { step: "css", surface: expect.stringContaining("globals.css") },
      { step: "js", surface: expect.stringContaining("cfz.ts") },
      { step: "lint", surface: expect.stringContaining("eslint.config.mjs") },
      { step: "runtime", surface: expect.stringContaining("canvas-first-z-stack.spec.ts") },
    ]);
  });

  it("each step carries a description and a verification command", () => {
    const steps = getTierBumpMigrationSteps();
    expect(steps).toHaveLength(4);
    for (const step of steps) {
      expect(step.description.length).toBeGreaterThan(20);
      expect(step.verification).toMatch(/^pnpm\b/);
    }
  });

  it("describeLadder surfaces the four-tier snapshot from CF_Z_FALLBACK", () => {
    const snap = describeLadder();
    expect(snap.tiers).toEqual([
      "canvas",
      "spatial",
      "chrome",
      "app",
    ]);
    expect(snap.values).toEqual([0, 10, 20, 30]);
    expect(snap.layout.get("canvas")).toBe(0);
    expect(snap.layout.get("app")).toBe(30);
  });

  it("the recipe format covers all four files in a printable block", () => {
    const block = formatMigrationRecipe();
    expect(block).toContain("globals.css");
    expect(block).toContain("cfz.ts");
    expect(block).toContain("eslint.config.mjs");
    expect(block).toContain("canvas-first-z-stack.spec.ts");
    expect(block).toContain("CSS");
    expect(block).toContain("JS");
    expect(block).toContain("LINT");
    expect(block).toContain("RUNTIME");
  });

  it("prints the recipe to stdout (developer aid during vitest runs)", () => {
    // Vitest doesn't enable no-console by default in this repo. The
    // recipe prints so developers running `pnpm test` see the upgrade
    // path inline. Always-true assertion so vitest registers a "pass"
    // for the run while still surfacing the recipe on stdout.
    console.log("\n" + formatMigrationRecipe());
    expect(true).toBe(true);
  });
});

/*
 * Recipe ↔ package.json drift check.
 *
 * Each `getTierBumpMigrationSteps()[i].verification` is a pnpm command
 * that operators run after editing the corresponding surface. If the
 * referenced script no longer exists in apps/web/package.json or root
 * package.json, the recipe lies to operators. Asserting against the
 * filesystem here closes that loop.
 */
describe("cfz.migration — recipe ↔ package.json", () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  // HERE = apps/web/src/components/canvas  →  5 ups = workstream root.
  const ROOT = path.join(HERE, "..", "..", "..", "..", "..");
  const ROOT_PKG = path.join(ROOT, "package.json");
  const WEB_PKG = path.join(ROOT, "apps", "web", "package.json");

  it("every recipe verify command resolves to a real pnpm script or test path", () => {
    const rootPkg = JSON.parse(readFileSync(ROOT_PKG, "utf8")) as {
      scripts: Record<string, string>;
    };
    const webPkg = JSON.parse(readFileSync(WEB_PKG, "utf8")) as {
      scripts: Record<string, string>;
    };

    const steps = getTierBumpMigrationSteps();
    for (const step of steps) {
      const cmd = step.verification.trim();
      // Match either "pnpm <script>" in root or
      // "pnpm --filter @workstream/web <script>" against apps/web.
      const rootMatch = /^pnpm\s+([a-z][a-z0-9:_-]+)/i.exec(cmd);
      const filterMatch =
        /^pnpm\s+--filter\s+\S+\s+([a-z][a-z0-9:_-]+)/i.exec(cmd);

      if (filterMatch) {
        const scriptName = filterMatch[1]!;
        expect(
          webPkg.scripts[scriptName],
          `Step "${step.step}" references "pnpm --filter @workstream/web ${scriptName}" but apps/web/package.json has no script "${scriptName}". Operator recipe is broken.`,
        ).toBeDefined();
        continue;
      }

      if (rootMatch) {
        const scriptName = rootMatch[1]!;
        // The recipe may also reference a direct vitest invocation
        // (e.g. `pnpm exec vitest run ...`) — those are not scripts
        // but bash one-liners. Verify by globbing the path.
        const directVitest = /^pnpm\s+exec\s+vitest\s+run\s+(\S+)/i.exec(cmd);
        if (directVitest) {
          const vitestPath = directVitest[1]!;
          const abs = path.join(ROOT, vitestPath);
          expect(
            existsSync(abs),
            `Step "${step.step}" references vitest path "${vitestPath}" which does not exist on disk. Operator recipe is broken.`,
          ).toBe(true);
          continue;
        }
        expect(
          rootPkg.scripts[scriptName],
          `Step "${step.step}" references "pnpm ${scriptName}" but root package.json has no script "${scriptName}". Operator recipe is broken.`,
        ).toBeDefined();
      }
    }
  });
});
