import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import { createAddressProject, seedElevationGarden } from "./helpers";

/**
 * The click-through a real operator makes to reach the project's non-canvas
 * surfaces, walked end to end.
 *
 * Why this is a kept spec and not a one-off probe: `/growth-studio/[id]` — a
 * finished 3D growth-maturity studio — shipped with no inbound link anywhere in
 * the product, and every gate stayed green because Next.js reaches a `page.tsx`
 * by filesystem. `scripts/check-route-reachability.mjs` now proves an href
 * *exists*; only a browser proves the operator can actually walk it and that
 * what they land on renders. Both are needed: the static gate cannot see a link
 * rendered behind a condition that is never true, which is the next mutation of
 * this bug.
 *
 * It also pins the Zero-Chrome law from `docs/GOLD-STANDARD-2026.md`: the
 * surface rail must not appear over the drawing.
 */

/** Console errors that are environmental, not the page's fault. */
const IGNORED = [
  /favicon/i,
  /Failed to load resource.*40[34]/i,
  /WebGL.*(deprecated|software)/i,
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

test.describe("Project surfaces are reachable by clicking", () => {
  test("home to canvas to records to the growth studio, and back", async ({
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

    // 1. The operator dashboard lists the project, and the card opens the canvas.
    await page.goto("/home");
    const card = page.locator(`a[href="/projects/${projectId}"]`).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`), {
      timeout: 30_000,
    });

    // 2. Zero-Chrome: the rail must never render over the drawing.
    await expect(
      page.getByRole("navigation", { name: "Project surfaces" }),
    ).toHaveCount(0);

    // 3. The canvas door into the records area lives in the Studio meta panel:
    //    open it, then follow Outputs. (`webgl/**` is owned elsewhere, so this
    //    spec pins the existing door rather than moving it.)
    await page.getByRole("button", { name: "Studio", exact: true }).click();
    const outputs = page
      .locator(`a[href="/projects/${projectId}/outputs"]`)
      .first();
    await expect(outputs).toBeVisible({ timeout: 30_000 });
    await outputs.click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/outputs`), {
      timeout: 30_000,
    });

    // 4. Every project surface is offered from there.
    const rail = page.getByRole("navigation", { name: "Project surfaces" });
    await expect(rail).toBeVisible({ timeout: 20_000 });
    for (const label of [
      "Growth studio",
      "Subsurface studio",
      "Outputs",
      "Audit",
      "Carbon",
      "Measurements",
      "Recordings",
    ]) {
      await expect(rail.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(rail.getByRole("link", { name: "Outputs" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // 5. The growth studio — the route that had no inbound link at all — opens
    //    and renders its own chrome.
    await rail.getByRole("link", { name: "Growth studio" }).click();
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

    expect(errors, `console errors during the walk:\n${errors.join("\n")}`).toEqual(
      [],
    );
  });

  test("the dashboard card offers a shallow door into the records area", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "E2E Surface Rail Card, 9 Reach St, Melbourne VIC 3000",
      seedCanvas: true,
    });
    const errors = watchConsole(page);

    await page.goto("/home");
    const records = page
      .locator(`a[href="/projects/${projectId}/outputs"]`)
      .first();
    await expect(records).toBeAttached({ timeout: 20_000 });
    await records.click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/outputs`), {
      timeout: 30_000,
    });
    await expect(
      page
        .getByRole("navigation", { name: "Project surfaces" })
        .getByRole("link", { name: "Growth studio" }),
    ).toBeVisible({ timeout: 20_000 });

    expect(errors, `console errors during the walk:\n${errors.join("\n")}`).toEqual(
      [],
    );
  });

  test("the rail reaches the audit surface and marks where you are", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "E2E Surface Rail Audit, 8 Reach St, Melbourne VIC 3000",
      seedCanvas: true,
    });
    const errors = watchConsole(page);

    await page.goto(`/projects/${projectId}/recordings`);
    const rail = page.getByRole("navigation", { name: "Project surfaces" });
    await expect(rail).toBeVisible({ timeout: 20_000 });

    // The pipeline progress screen's only entry point lives on this surface.
    await expect(
      page.locator(`a[href="/projects/${projectId}/processing"]`),
    ).toBeVisible();

    await rail.getByRole("link", { name: "Audit" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/audit`), {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Audit" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("navigation", { name: "Project surfaces" })
        .getByRole("link", { name: "Audit" }),
    ).toHaveAttribute("aria-current", "page");

    expect(errors, `console errors during the walk:\n${errors.join("\n")}`).toEqual(
      [],
    );
  });
});
