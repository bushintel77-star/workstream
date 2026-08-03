import { expect, test } from "@playwright/test";

/**
 * Kept probe for the /home planner RailDrawer hover contract.
 *
 * The component had three latent bugs and zero e2e coverage:
 *  1. `HOVER_DELAY_MS` was declared and never used, so the drawer opened the
 *     instant the pointer crossed it.
 *  2. `hovered` stays true when the handle is clicked, so the hover effect
 *     re-opened the drawer immediately — it could not be closed by clicking
 *     while the pointer was on it.
 *  3. The hover effect early-returned when open, so the documented
 *     "auto-retract after linger on mouse leave" never ran.
 *
 * All three are timing/state behaviour that typecheck and unit tests cannot
 * see, which is why this is a Playwright probe.
 *
 * Geometry note: closed, the drawer is `translateX(calc(100% - 2px))`, so its
 * bounding box is almost entirely off-viewport and only a ~2px sliver at the
 * right edge is hoverable. Hover targets are therefore the viewport edge, not
 * the element's box centre — a boundingBox()-based hover silently never lands
 * and every assertion passes for the wrong reason.
 */

const DESKTOP = { width: 1440, height: 900 };
/** Matches HOVER_DELAY_MS in RailDrawer.tsx. */
const HOVER_DELAY_MS = 250;
/** Matches LINGER_MS. */
const LINGER_MS = 1200;

/** The only hoverable part of a closed drawer. */
const EDGE_X = DESKTOP.width - 1;
const EDGE_Y = Math.round(DESKTOP.height / 2);

async function gotoHome(page: import("@playwright/test").Page) {
  await page.setViewportSize(DESKTOP);
  await page.goto("/home");
  const drawer = page.getByTestId("rail-drawer");
  await expect(drawer).toBeVisible({ timeout: 30_000 });
  await expect(drawer).toHaveAttribute("data-open", "0");
  // Park the pointer away from the right edge before each scenario.
  await page.mouse.move(20, 20);
  return drawer;
}

test.describe("Rail drawer hover contract", () => {
  test("an incidental pointer crossing does not open the drawer", async ({
    page,
  }) => {
    const drawer = await gotoHome(page);

    // Dwell long enough that React has definitely processed the mouseenter and
    // run the hover effect, but still short of the open threshold. Too short
    // here (~80ms) and the enter/leave pair collapses before the effect sees
    // `hovered` at all, which made this assertion pass even against the
    // immediate-open bug it exists to catch.
    await page.mouse.move(EDGE_X, EDGE_Y);
    await page.waitForTimeout(150);
    await page.mouse.move(20, 20);

    // Past the dwell it must still be shut — the pending peek was cancelled.
    await page.waitForTimeout(HOVER_DELAY_MS * 3);
    await expect(drawer).toHaveAttribute("data-open", "0");
  });

  test("dwelling past the delay opens it, and leaving retracts the peek", async ({
    page,
  }) => {
    const drawer = await gotoHome(page);

    await page.mouse.move(EDGE_X, EDGE_Y);
    await expect(drawer).toHaveAttribute("data-open", "1", {
      timeout: HOVER_DELAY_MS + 5_000,
    });

    // A peek is not pinned: leaving retracts it after the linger.
    await page.mouse.move(20, 20);
    await expect(drawer).toHaveAttribute("data-open", "0", {
      timeout: LINGER_MS + 5_000,
    });
  });

  test("clicking the handle closes it even while the pointer stays on it", async ({
    page,
  }) => {
    const drawer = await gotoHome(page);

    // Peek it open so the handle slides into the viewport.
    await page.mouse.move(EDGE_X, EDGE_Y);
    await expect(drawer).toHaveAttribute("data-open", "1", {
      timeout: HOVER_DELAY_MS + 5_000,
    });

    const handle = drawer.getByRole("button", { name: /Planner/ });
    await expect(handle).toHaveAttribute("aria-expanded", "true");

    // The pointer is still on the drawer. Before the fix the hover effect
    // re-opened it here, so the drawer could not be dismissed at all.
    await handle.click();
    await expect(drawer).toHaveAttribute("data-open", "0");
    await page.waitForTimeout(HOVER_DELAY_MS * 3);
    await expect(drawer).toHaveAttribute("data-open", "0");
  });

  test("leaving and returning re-arms the peek after a dismissal", async ({
    page,
  }) => {
    const drawer = await gotoHome(page);

    await page.mouse.move(EDGE_X, EDGE_Y);
    await expect(drawer).toHaveAttribute("data-open", "1", {
      timeout: HOVER_DELAY_MS + 5_000,
    });
    await drawer.getByRole("button", { name: /Planner/ }).click();
    await expect(drawer).toHaveAttribute("data-open", "0");

    // The dismissal latch is released on leave, not held forever.
    await page.mouse.move(20, 20);
    await page.waitForTimeout(HOVER_DELAY_MS);
    await page.mouse.move(EDGE_X, EDGE_Y);
    await expect(drawer).toHaveAttribute("data-open", "1", {
      timeout: HOVER_DELAY_MS + 5_000,
    });
  });
});
