import { expect, test } from "@playwright/test";
import {
  createWrightsTier1Project,
  handoffStudio,
  seedElevationGarden,
} from "./helpers";
import { contrastFailures } from "./contrast-helpers";

/**
 * WCAG 2.2 AA text contrast gate for the operator canvas.
 *
 * Every mode is walked and every rendered text node is measured against its
 * *composited* background (chrome is layered translucent glass, so the parent
 * chain has to be flattened before the ratio means anything).
 *
 * This started as a one-off audit that found 23 failures across 22 rules — the
 * Tier-1 ledger heading was rendering dark-shell ink on white paper at 1.21:1,
 * and `--text-muted` (#9aa0ac) sat at 2.63:1 everywhere it labelled chrome.
 * Keep it green: the failure message names the class and the exact ratio.
 *
 * Gotcha for future edits: `color-mix()` computes to CSS Color 4
 * `color(srgb r g b / a)` whose channels are 0-1 floats, not 0-255. The parser
 * below scales them; drop that and every mixed surface silently reads as black.
 */

const MODES = ["survey", "sketch", "cad", "elevation", "quote"] as const;

test.describe("Canvas text contrast (WCAG 2.2 AA)", () => {
  test("every studio mode keeps all text at or above AA", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const { projectId } = await createWrightsTier1Project(request, {
      seedCanvas: true,
    });
    await seedElevationGarden(request, projectId);
    await page.setViewportSize({ width: 1600, height: 950 });

    const report: string[] = [];
    for (const mode of MODES) {
      // The classic surfaces carry the dense text — audit them explicitly
      // (the default WebGL mount owns sketch/quote natively).
      await page.goto(`/projects/${projectId}?svg=1&mode=${mode}`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
      // Let coaching cards / lanes finish their enter animation before reading
      // computed colour, or a mid-fade opacity is measured as a failure.
      await page.waitForTimeout(2500);

      for (const f of await contrastFailures(page)) {
        report.push(
          `${mode}: ${f.ratio}:1 (needs ${f.need}) ${f.size}px w${f.weight} ` +
            `${f.fg} on ${f.bg} — "${f.text}" [${f.cls}]`,
        );
      }
    }

    expect(report, `WCAG AA text contrast failures:\n${report.join("\n")}`).toEqual(
      [],
    );
  });

});
