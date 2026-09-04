import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import { createAddressProject, seedElevationGarden } from "./helpers";

/**
 * The click-through a real operator makes to reach the project's records
 * surfaces and the growth studio, walked end to end.
 *
 * Rewritten 2026-09-05 against the CURRENT information architecture. The
 * original walks (dashboard cards on /home, a "Studio" meta-panel door, the
 * "Project surfaces" rail) died with the dashboard purge (`dcf7018` deleted
 * HomePlanner + RailDrawer as dead code) and the specs stayed red for a week
 * — which is exactly how a kept gate turns into noise nobody reads.
 *
 * The law this spec pins TODAY:
 *   - /home lands the operator on their newest project's canvas (redirect,
 *     never a card list);
 *   - the command palette (Ctrl+K) is the ONLY inbound door to the records
 *     surfaces and the studios — including /growth-studio/[id], which once
 *     shipped with no inbound link at all because Next.js reaches a page.tsx
 *     by filesystem (`scripts/check-route-reachability.mjs` proves an href
 *     exists; only a browser proves the operator can walk it);
 *   - the records surfaces carry the "Project records navigation" rail for
 *     moving between them, with aria-current marking where you are;
 *   - Zero-Chrome: no records rail ever renders over the drawing.
 */

/** Console errors that are environmental, not the page's fault. */
const IGNORED = [
  /favicon/i,
  /Failed to load resource.*40[34]/i,
  /WebGL.*(deprecated|software)/i,
  /WebGL context lost/i,
  /Download the React DevTools/i,
];

function watchConsole(page: Page) {
  const errors: string[] = [];
  const onMessage = (message: ConsoleMessage) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (IGNORED.some((pattern) => pattern.test(text))) return;
    errors.push(text);
  };
  page.on("console", onMessage);
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** The records nav — the inter-surface rail ProjectUtilitySurface renders. */
const RECORDS_RAIL = "Project records navigation";

async function openPalette(page: Page) {
  // The Ctrl+K handler lives on the studio's client bundle — wait for the
  // studio itself before summoning, or the keystroke lands on a page whose
  // listener is not attached yet.
  await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
    timeout: 30_000,
  });
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("studio-command-palette")).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("Project records + studios are reachable by clicking", () => {
  test("home lands on the canvas; the palette reaches outputs and the growth studio; back", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "E2E Surface Rail, 7 Reach St, Melbourne VIC 3000",
      seedCanvas: true,
    });
    // Real planting, so the studio renders its simulation rather than its
    // honest "no planting on this board yet" empty state.
    await seedElevationGarden(request, projectId);
    const errors = watchConsole(page);

    // 1. /home IS a redirect to the newest project's canvas — there is no
    //    separate pre-canvas page to list cards any more.
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.waitForURL(new RegExp(`/projects/${projectId}`), {
      timeout: 30_000,
    });

    // 2. Zero-Chrome: no records rail over the drawing.
    await expect(
      page.getByRole("navigation", { name: RECORDS_RAIL }),
    ).toHaveCount(0);

    // 3. The command palette is the only door into the records: take it to
    //    Outputs.
    await openPalette(page);
    await page.getByTestId("command-records-outputs").click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/outputs`), {
      timeout: 30_000,
    });

    // 4. Every record is offered from there, and the rail marks where you
    //    are. The studios are deliberately NOT in this rail — the palette is
    //    their only inbound link.
    const rail = page.getByRole("navigation", { name: RECORDS_RAIL });
    await expect(rail).toBeVisible({ timeout: 20_000 });
    for (const label of [
      "Outputs",
      "Audit",
      "Carbon",
      "Measurements",
      "Recordings",
    ]) {
      await expect(rail.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(rail.getByRole("link", { name: "Growth studio" })).toHaveCount(
      0,
    );
    await expect(rail.getByRole("link", { name: "Outputs" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // 5. Back to the drawing, then the palette door to the growth studio —
    //    the route that once had no inbound link at all.
    await page.goto(`/projects/${projectId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 30_000,
    });
    await openPalette(page);
    await page.getByTestId("command-records-growth-studio").click();
    await expect(page).toHaveURL(new RegExp(`/growth-studio/${projectId}`), {
      timeout: 30_000,
    });
    await expect(page.getByTestId("growth-studio-root")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("10-year growth simulation")).toBeVisible();
    // The simulation itself, not the empty state: the transport scrubber and
    // the impact card only render once real placements are read off the canvas.
    await expect(page.getByTestId("growth-studio-scrubber")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("growth-studio-impact-card")).toBeVisible();

    // 6. And it leads back to the drawing rather than being a dead end.
    await page.getByRole("link", { name: /Back to canvas/ }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`), {
      timeout: 30_000,
    });

    expect(
      errors,
      `console errors during the walk:\n${errors.join("\n")}`,
    ).toEqual([]);
  });

  test("the records rail reaches audit and marks where you are", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "E2E Surface Rail Audit, 8 Reach St, Melbourne VIC 3000",
      seedCanvas: true,
    });
    const errors = watchConsole(page);

    await page.goto(`/projects/${projectId}/recordings`);
    const rail = page.getByRole("navigation", { name: RECORDS_RAIL });
    await expect(rail).toBeVisible({ timeout: 20_000 });

    await rail.getByRole("link", { name: "Audit" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/audit`), {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Audit" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page
        .getByRole("navigation", { name: RECORDS_RAIL })
        .getByRole("link", { name: "Audit" }),
    ).toHaveAttribute("aria-current", "page");

    expect(
      errors,
      `console errors during the walk:\n${errors.join("\n")}`,
    ).toEqual([]);
  });
});
