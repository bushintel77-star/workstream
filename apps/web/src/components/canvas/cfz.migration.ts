/*
 * cfz.migration.ts — procedural tier-bump migration recipe.
 *
 * Surfaces the FOUR-STEP migration sequence on demand. The contract's
 * migration recipe (docs/CANVAS-FIRST-Z-STACK-CONTRACT.md §4) is
 * hand-curated prose; this file is the programmatic mirror so the
 * recipe can be asserted at test time and surfaced in dev tools
 * (the new CfzTierInspector HUD uses it for an "Intent to add a fifth
 * rung?" hint).
 *
 * Crucially: every numeric value comes from CF_Z_FALLBACK so the
 * recipe cannot drift away from the actual ladder. If a future
 * contributor extends the four rungs, this helper auto-finds that
 * change without a manual edit.
 *
 * The companion test (cfz.migration.test.ts) prints the recipe to
 * stdout on dev runs and asserts each step references the correct
 * surface. CI catches the recipe if it forgets a step.
 */

import { CF_Z_FALLBACK, type CfTier } from "./cfz";

export const EXPECTED_LADDER_STEPS = [
  "css",
  "js",
  "lint",
  "runtime",
] as const;

export type LadderStep = (typeof EXPECTED_LADDER_STEPS)[number];

export interface MigrationStep {
  step: LadderStep;
  surface: string; // Single-file target the operator edits.
  description: string;
  verification: string; // CLI the operator runs to confirm the step.
}

const STEP_SURFACE: Record<LadderStep, string> = {
  css: "apps/web/src/styles/globals.css",
  js: "apps/web/src/components/canvas/cfz.ts",
  lint: "eslint.config.mjs",
  runtime: "apps/web/e2e/canvas-first-z-stack.spec.ts",
};

const STEP_VERIFICATION: Record<LadderStep, string> = {
  css: "pnpm exec vitest run apps/web/src/components/canvas/cfz.parity.test.ts",
  js: "pnpm exec vitest run apps/web/src/components/canvas/cfz.test.ts",
  lint: "pnpm --filter @workstream/web lint",
  runtime: "pnpm --filter @workstream/web web:check-canvas-first-zstack",
};

const STEP_DESCRIPTION: Record<LadderStep, string> = {
  css: "Declare the new --cf-z-<tier> token next to the four existing ones. Update the drei ladder comment block to reference the new rung.",
  js: "Extend CfTier; add the new key to CF_Z_FALLBACK and CF_Z_PAIRS; document the new pair's intent in JSDoc on CF_Z_PAIRS.",
  lint: "Open no-restricted-syntax — the registry closes itself because cfZPair is keyof-typed on CF_Z_PAIRS. Confirm cfz.registry.test.ts still passes (4-tier set, sole publisher).",
  runtime: "Update EXPECTED_LAYERS and EXPECTED_Z in canvas-first-z-stack.spec.ts; bump createWrightsTier1Project if new rung needs previously-unlocked progression.",
};

/** Render the four migration steps as a printable block. */
export function getTierBumpMigrationSteps(): MigrationStep[] {
  return EXPECTED_LADDER_STEPS.map((step) => ({
    step,
    surface: STEP_SURFACE[step],
    description: STEP_DESCRIPTION[step],
    verification: STEP_VERIFICATION[step],
  }));
}

/** Tier inventory snapshot — used by recipes and dev tools. */
export function describeLadder(): {
  tiers: readonly CfTier[];
  values: readonly number[];
  layout: ReadonlyMap<CfTier, number>;
} {
  const tiers = Object.keys(CF_Z_FALLBACK) as CfTier[];
  const values = tiers.map((t) => CF_Z_FALLBACK[t]);
  return { tiers, values, layout: new Map(tiers.map((t) => [t, CF_Z_FALLBACK[t]])) };
}

/**
 * Render a one-shot, human-readable migration recipe. Used by the dev
 * HUD's "Intent to add a fifth rung?" hint and the migration test.
 */
export function formatMigrationRecipe(): string {
  const steps = getTierBumpMigrationSteps();
  const width = 76;
  const lines: string[] = [];
  lines.push("=".repeat(width));
  lines.push("  Canvas-First Z-Stack — TIER-BUMP MIGRATION RECIPE");
  lines.push("=".repeat(width));
  lines.push("");
  lines.push("  When introducing a new visible rung (fifth tier):");
  lines.push("");
  steps.forEach((s, i) => {
    const n = `  ${i + 1}. ${s.step.toUpperCase()}`.padEnd(14);
    lines.push(`${n}  Edit:  ${s.surface}`);
    lines.push(`${" ".repeat(14)}  ${s.description}`);
    lines.push(`${" ".repeat(14)}  Verify: ${s.verification}`);
    lines.push("");
  });
  lines.push("  If any verification step fails, that step's guard has");
  lines.push("  caught the drift; fix that surface and re-run.");
  lines.push("=".repeat(width));
  return lines.join("\n");
}
