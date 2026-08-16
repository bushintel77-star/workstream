import { expect, test, type Page } from "@playwright/test";
import {
  clickHeaderViewItem,
  createCarltonControlProject,
  createWrightsTier1Project,
  handoffStudio,
} from "./helpers";

/**
 * Opens the Live Cost Rail alongside the CAD drawing, then expands it to the
 * full QuoteBuilder so the Tier-1 ledger and target are rendered.
 */
async function openQuoteBuilder(page: Page, projectId: string) {
  // The QuoteBuilder lives on the legacy SVG studio — WebGL is the default
  // mount since a1a5c43, so the SVG surface needs ?svg=1.
  await page.goto(`/projects/${projectId}?svg=1&mode=cad&svg=1`);
  await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
  await clickHeaderViewItem(page, "live-cost-top");
  await expect(page.getByTestId("live-cost-rail")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId("live-cost-rail-expand").click();
  await expect(page.getByTestId("quote-surface")).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Kept Tier-1 Quote smoke — Wrights Terrace address gate + savings ledger
 * target ($58,410) on the handoff Quote surface.
 *
 * Gate must use the project create address (not STUDIO_SITES seed label),
 * otherwise every project would show the Tier-1 ledger.
 */
test.describe("Tier-1 Quote ledger", () => {
  test("Wrights Prahran shows ledger target on Quote with a costed BOM", async ({
    page,
    request,
  }) => {
    const { projectId } = await createWrightsTier1Project(request);

    await openQuoteBuilder(page, projectId);
    await expect(page.getByTestId("quote-empty-state")).toHaveCount(0);
    await expect(page.getByTestId("tier1-quote-ledger")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("tier1-quote-target")).toContainText(
      /Target quote \$58,410/,
    );
  });

  test("non-Wrights address does not show the Tier-1 ledger", async ({
    page,
    request,
  }) => {
    const { projectId } = await createCarltonControlProject(request);

    await openQuoteBuilder(page, projectId);
    await expect(page.getByTestId("tier1-quote-ledger")).toHaveCount(0);
  });
});
