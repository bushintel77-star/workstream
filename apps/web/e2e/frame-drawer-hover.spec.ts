import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

/**
 * Kept probe for the canvas FrameDrawer hover contract.
 *
 * Same class of bug as the /home RailDrawer (rail-drawer-hover.spec.ts):
 * setOpen(true) fired the instant the pointer crossed the handle, with no
 * dwell, so the 320px right drawer and the top artboards bar both slid over
 * the drawing on every incidental pointer crossing. The fix adds a
 * HOVER_DELAY_MS dwell before the open, matching RailDrawer's pattern.
 *
 * Geometry: closed, the drawer is translateX(calc(100% - 2px)), so only a
 * ~2px sliver at the right viewport edge is hoverable. Hover targets are the
 * viewport edge, not the element's box centre.
 */

const DESKTOP = { width: 1440, height: 900 };
/** Matches HOVER_DELAY_MS in FrameDrawer.tsx. */
const HOVER_DELAY_MS = 250;
/** Matches LINGER_MS. */
const LINGER_MS = 600;

/** The only hoverable part of a closed right-edge drawer. */
const EDGE_X = DESKTOP.width - 1;
const EDGE_Y = Math.round(DESKTOP.height / 2);

async function gotoSurvey(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
  await page.setViewportSize(DESKTOP);
  const { projectId } = await createSurveyProject(request);
  await page.goto(`/projects/${projectId}?mode=survey`);
  await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
  const shell = page.getByTestId("frame-drawer-site-meta");
  await expect(shell).toBeVisible({ timeout: 15_000 });
  // data-open lives on the inner .drawer div, not the CameraChrome shell.
  const drawer = shell.locator("[data-open]");
  await expect(drawer).toHaveAttribute("data-open", "0");
  // Park the pointer away from the right edge before each scenario.
  await page.mouse.move(20, 20);
  return drawer;
}

test.describe("FrameDrawer hover contract", () => {
  test("an incidental pointer crossing does not open the drawer", async ({
    page,
    request,
  }) => {
    const drawer = await gotoSurvey(page, request);

    // Cross the edge and dwell long enough that React has processed the
    // mouseenter, but still short of the open threshold.
    await page.mouse.move(EDGE_X, EDGE_Y);
    await page.waitForTimeout(150);

    // The drawer must not have opened during the crossing. With the bug
    // (no dwell), setOpen(true) fired immediately and data-open was "1"
    // here. With the fix, the pending open is still waiting for the dwell.
    //
    // Read the attribute at a point in time — do NOT use toHaveAttribute,
    // which polls for 5000ms. The idle retract (4000ms) would close the
    // drawer within that window, making the assertion pass even against
    // the immediate-open bug it exists to catch. Same trap the RailDrawer
    // probe warns about.
    const openAt150 = await drawer.getAttribute("data-open");
    expect(openAt150, "drawer opened on incidental crossing — no dwell").toBe("0");

    // Leave before the dwell expires. The pending open is cancelled.
    await page.mouse.move(20, 20);
    await page.waitForTimeout(HOVER_DELAY_MS * 3);
    expect(await drawer.getAttribute("data-open")).toBe("0");
  });

  test("dwelling past the delay opens it, and leaving retracts it", async ({
    page,
    request,
  }) => {
    const drawer = await gotoSurvey(page, request);

    await page.mouse.move(EDGE_X, EDGE_Y);
    await expect(drawer).toHaveAttribute("data-open", "1", {
      timeout: HOVER_DELAY_MS + 5_000,
    });

    // Leaving retracts after the linger.
    await page.mouse.move(20, 20);
    await expect(drawer).toHaveAttribute("data-open", "0", {
      timeout: LINGER_MS + 5_000,
    });
  });
});
