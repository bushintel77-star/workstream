/**
 * Live Quote dock companion — Fit tab + pill/card in the right dock.
 *
 * FitSheetCard mounts as a flow child of the right dock (estimation-dock-spec
 * §3, restored 2026-08-22). The pill expands to the itemized card; Esc
 * collapses back. Expanded preference persists in localStorage.
 */

import { expect, test, type Page } from "@playwright/test";

import { createWrightsTier1Project } from "./helpers";

async function gotoStudioQuote(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}?mode=quote&webgl=1`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("perimeter-tab-strip")).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Live Quote dock companion", () => {
  test("pill mounts inside the right dock, not fixed to the viewport", async ({
    page,
    request,
  }) => {
    const { projectId } = await createWrightsTier1Project(request);
    await gotoStudioQuote(page, projectId);

    const pill = page.getByTestId("fit-sheet-pill");
    await expect(pill).toBeVisible({ timeout: 15_000 });

    const position = await pill.evaluate((el) => {
      const wrap = el.parentElement;
      return {
        wrap: wrap ? getComputedStyle(wrap).position : null,
      };
    });
    expect(
      position.wrap,
      `expected docked pill wrapper (relative/static), got "${position.wrap}"`,
    ).not.toBe("fixed");
    expect(position.wrap).toBe("relative");

    const chrome = page.locator("[data-webgl-chrome]");
    await expect(chrome).toBeAttached();
    await expect(pill).toBeVisible();

    const placement = await pill.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        inChrome: !!el.closest("[data-webgl-chrome]"),
        rightEdge: rect.right,
        viewportWidth: window.innerWidth,
      };
    });
    expect(placement.inChrome).toBe(true);
    expect(placement.rightEdge).toBeGreaterThan(placement.viewportWidth * 0.55);
  });

  test("click pill expands to the capsule; Esc collapses back", async ({
    page,
    request,
  }) => {
    const { projectId } = await createWrightsTier1Project(request);
    await gotoStudioQuote(page, projectId);

    const pill = page.getByTestId("fit-sheet-pill");
    await expect(pill).toBeVisible({ timeout: 15_000 });
    await pill.click({ force: true });

    const card = page.getByTestId("fit-sheet-card");
    await expect(card).toBeVisible({ timeout: 8_000 });
    await expect(card.getByTestId("fit-sheet-total")).toBeVisible();
    await expect(card.getByTestId("fit-sheet-lines")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(pill).toBeVisible();
    await expect(card).not.toBeVisible();
  });

  test("expanded preference persists across navigation", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const { projectId } = await createWrightsTier1Project(request);
    await gotoStudioQuote(page, projectId);

    const pill = page.getByTestId("fit-sheet-pill");
    await expect(pill).toBeVisible({ timeout: 15_000 });
    await pill.click({ force: true });
    await expect(page.getByTestId("fit-sheet-card")).toBeVisible({
      timeout: 8_000,
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("workstream.fitSheet.expanded"),
        ),
      )
      .toBe("1");

    await page.goto(`/projects/${projectId}?mode=quote&webgl=1`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      page.getByTestId("fit-sheet-card"),
      "expected expanded preference to re-open as capsule",
    ).toBeVisible({ timeout: 10_000 });
  });
});
