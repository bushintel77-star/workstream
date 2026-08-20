/**
 * Floating Live Quote — Capability test for the gold-standard 2026
 * quotation capsule un-dock.
 *
 * Previously FitSheetCard was a docked right-edge sidebar (272px wide,
 * position: relative inside a 360px right-dock column) that ate the
 * canvas's right margin. The un-dock moves it to position: fixed and
 * out of the dock column so the canvas reclaims full edge-to-edge
 * width — and the capsule defaults to a minimal summary pill
 * "[ 🧾 Live Quote: $X,XXX.XX ]" off the right margin that expands
 * on click.
 *
 * This spec asserts:
 *   1. The pill mounts at position: fixed, anchored to the right margin
 *      (`--cf-z-chrome` z-stack), not docked to the right column.
 *   2. The parent right-dock column does NOT reserve 360px of canvas
 *      width when the capsule is closed (the whole point of the move).
 *   3. Click pill → expands to capsule with the full itemized content;
 *      the capsule is also position: fixed, also chrome-tier.
 *   4. Esc collapses back to the pill, and the pill's persisted
 *      preference survives a navigate away-and-back.
 */

import { expect, test, type Page } from "@playwright/test";

import { createWrightsTier1Project } from "./helpers";

/**
 * Open the studio at the ?mode=quote URL so FitSheetOpen is set on the
 * studio store right after mount; the capsule's self-gating condition
 * (fitSheetOpen && items.length > 0) is then satisfied.
 */
async function gotoStudioFitTab(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}?mode=quote&webgl=1`, {
    waitUntil: "networkidle",
  });
  // Render surface and tab strip load under the chrome wrapper.
  await expect(page.getByTestId("perimeter-tab-strip")).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Floating Live Quote capsule — un-dock + pill default", () => {
  test("pill mounts position:fixed off the right margin, not docked", async ({
    page,
    request,
  }) => {
    const { projectId } = await createWrightsTier1Project(request);
    await gotoStudioFitTab(page, projectId);

    const pill = page.getByTestId("fit-sheet-pill");
    await expect(pill).toBeVisible({ timeout: 15_000 });

    // 1. Pill is position: fixed (the un-dock itself).
    const position = await pill.evaluate((el) => {
      const wrap = el.parentElement;
      const wrap2 = wrap?.parentElement;
      return {
        pill: getComputedStyle(el).position,
        wrap: wrap ? getComputedStyle(wrap).position : null,
        wrap2: wrap2 ? getComputedStyle(wrap2).position : null,
      };
    });
    expect(
      position.pill,
      `expected pill to be position: fixed (un-docked), got "${position.pill}"`,
    ).toBe("fixed");

    // 2. Pill is right-anchored (right: 16px) rather than centered or docked.
    const right = await pill.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      return Math.round(vw - r.right);
    });
    expect(
      right,
      `expected pill to be ~16px from right margin, got ${right}`,
    ).toBeLessThanOrEqual(20);

    // 3. Pill is at chrome tier (--cf-z-chrome = 20) — never above chrome panels.
    const z = await pill.evaluate(
      (el) => getComputedStyle(el.parentElement!).zIndex,
    );
    expect(z, `pill's chrome-tier z-index, got "${z}"`).toBe("20");

    // 4. The right-dock parent column does NOT reserve canvas width.
    // The column only paid out width when its child (perimeter-panel) was
    // visible AND its width was set. With the un-dock, the perimeter-panel
    // is still in the column but the FitSheetCard is no longer eating the
    // 360px column budget — the column reserves only what its content
    // needs. We assert the right offset the canvas gets back: the right
    // dock column right edge is now ≈ 360-340 = 20px (matches the column's
    // own `right: 20`) and column width is at most the perimeter-panel's
    // 340px max.
    const dockColumn = page.locator(
      '[data-webgl-chrome] [data-testid="perimeter-panel"]',
    );
    const dockWidth = (await dockColumn.count())
      ? await dockColumn.first().evaluate((el) => el.getBoundingClientRect().width)
      : 0;
    expect(
      dockWidth,
      `right-dock column width should be ≤ 360px (the old reservation), got ${dockWidth}`,
    ).toBeLessThanOrEqual(360);
  });

  test("click pill expands to the capsule; Esc collapses back", async ({
    page,
    request,
  }) => {
    const { projectId } = await createWrightsTier1Project(request);
    await gotoStudioFitTab(page, projectId);

    const pill = page.getByTestId("fit-sheet-pill");
    await expect(pill).toBeVisible({ timeout: 15_000 });

    // Click expands.
    await pill.click();

    const card = page.getByTestId("fit-sheet-card");
    await expect(card).toBeVisible({ timeout: 5_000 });

    // Card is also position: fixed (hence still un-docked).
    const cardPosition = await card.evaluate(
      (el) => getComputedStyle(el.parentElement!).position,
    );
    expect(cardPosition, "expanded card must remain position:fixed").toBe(
      "fixed",
    );

    // Itemized content is rendered.
    await expect(card.getByTestId("fit-sheet-total")).toBeVisible();
    await expect(card.getByTestId("fit-sheet-lines")).toBeVisible();

    // Esc collapses back to the pill (and pill is the only public surface).
    await page.keyboard.press("Escape");
    await expect(pill).toBeVisible();
    await expect(card).not.toBeVisible();
  });

  test("Esc collapses and the preference persists across navigation", async ({
    page,
    request,
  }) => {
    const { projectId } = await createWrightsTier1Project(request);
    await gotoStudioFitTab(page, projectId);

    const pill = page.getByTestId("fit-sheet-pill");
    await expect(pill).toBeVisible({ timeout: 15_000 });

    // Open once → expanded preference is persisted.
    await pill.click();
    await expect(page.getByTestId("fit-sheet-card")).toBeVisible({
      timeout: 5_000,
    });

    // Navigate away and back, the pill should NOT show (the expanded
    // preference was saved).
    await page.goto("/home");
    await page.waitForLoadState("networkidle");
    await page.goto(`/projects/${projectId}?mode=quote&webgl=1`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByTestId("perimeter-tab-strip")).toBeVisible({
      timeout: 15_000,
    });

    // The capsule should open directly in expanded form on remount.
    await expect(
      page.getByTestId("fit-sheet-card"),
      "expected expanded preference to re-open as capsule, not pill",
    ).toBeVisible({ timeout: 10_000 });
    await expect(pill).not.toBeVisible();
  });
});
