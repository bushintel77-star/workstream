import { expect, test } from "@playwright/test";
import {
  clickHeaderViewItem,
  createSurveyProject,
  handoffStudio,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Kept probe for the AI capability cue — the only surface that tells an
 * operator the assistant can do anything. Everything else about the AI is
 * behind a glyph, so if this stops rendering the capability is invisible again.
 *
 * The contract has two halves and both matter:
 *  - it appears when a capability is genuinely applicable, and
 *  - it teaches once. `STUDIO-STYLING-AND-UX.md` §6 item 11 requires a feature
 *    to degrade invisibly, so an acknowledged cue must leave no residue, across
 *    reloads, or it becomes the nagging chrome the rule exists to prevent.
 *
 * A traced lot with no placements is used as the trigger state because it is
 * reachable through the API without depending on Vicmap WFS or aerial tiles,
 * which CI runners routinely miss.
 */

/** Closed 4-point lot, no placements — the cue's precondition. */
async function seedTracedEmptyLot(
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
) {
  const put = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [],
      site_frame: {
        boundary: [
          { x_pct: 18, y_pct: 16 },
          { x_pct: 82, y_pct: 16 },
          { x_pct: 82, y_pct: 84 },
          { x_pct: 18, y_pct: 84 },
        ],
        building_source: "traced",
      },
    },
  });
  expect(put.ok()).toBeTruthy();
}

test.describe("AI capability cue", () => {
  test("appears on a traced empty lot and stays gone once dismissed", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await seedTracedEmptyLot(request, projectId);

    await page.goto(`/projects/${projectId}?svg=1&mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    const cue = page.getByTestId("ai-capability-cue");
    await expect(cue).toBeVisible({ timeout: 20_000 });

    // The cue must name an outcome, not a feature — it is the only place the
    // assistant's capability is stated in words.
    await expect(cue).toHaveAttribute("data-capability", /canopy|layout/);
    await expect(
      page.getByTestId("ai-capability-cue-run"),
    ).toBeVisible();

    await page.getByTestId("ai-capability-cue-dismiss").click();
    await expect(cue).toBeHidden();

    // Acknowledgement is persisted per project: a cue teaches once.
    await page.reload();
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("ai-capability-cue")).toBeHidden();
  });

  test("does not teach over the client view", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);
    await seedTracedEmptyLot(request, projectId);

    // The Live Cost Rail (quote) is not a drawing surface, so no cue belongs
    // there. Open the rail alongside CAD and confirm the cue stays hidden.
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await clickHeaderViewItem(page, "live-cost-top");
    await expect(page.getByTestId("live-cost-rail")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("ai-capability-cue")).toBeHidden();
  });

  test("a fresh project does not inherit another project's dismissal", async ({
    page,
    request,
  }) => {
    const first = await createSurveyProject(request);
    await seedTracedEmptyLot(request, first.projectId);
    await page.goto(`/projects/${first.projectId}?svg=1&mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("ai-capability-cue")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId("ai-capability-cue-dismiss").click();
    await expect(page.getByTestId("ai-capability-cue")).toBeHidden();

    // Same browser, same localStorage, different project: still teaches.
    const second = await createSurveyProject(request);
    await seedTracedEmptyLot(request, second.projectId);
    await page.goto(`/projects/${second.projectId}?svg=1&mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("ai-capability-cue")).toBeVisible({
      timeout: 20_000,
    });
  });
});
