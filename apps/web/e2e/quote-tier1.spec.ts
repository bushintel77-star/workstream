import { expect, test } from "@playwright/test";
import {
  createCarltonControlProject,
  createWrightsTier1Project,
  handoffStudio,
} from "./helpers";

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

    await page.goto(`/projects/${projectId}?mode=quote`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(handoffStudio(page)).toHaveAttribute(
      "data-canvas-mode",
      "quote",
    );
    await expect(page.getByTestId("quote-surface")).toBeVisible({
      timeout: 15_000,
    });
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

    await page.goto(`/projects/${projectId}?mode=quote`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("quote-surface")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("tier1-quote-ledger")).toHaveCount(0);
  });
});
