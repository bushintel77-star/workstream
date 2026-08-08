import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio, expectToolDock } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Kept smoke for docs/INTERACTION-LOGIC.md — the click contract.
 *
 * Rule 2: in a drawing/placing tool, objects are inert (no silent select).
 * Rule 3: selection is the ground state — the Select tool selects.
 * Rule 4: no Pan tool remains in the dock.
 */
test.describe("Interaction contract (tool owns the click)", () => {
  test("Pan chip deleted, objects inert under Trace, Select selects", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    const idA = randomUUID();
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: idA,
              symbol_id: "bluestone-paver",
              x_pct: 50,
              y_pct: 48,
              rotation_deg: 0,
              scale: 1,
            },
          ],
          strokes: [],
          irrigation_zones: [],
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toHaveAttribute(
      "data-mode",
      "cad",
      { timeout: 15_000 },
    );
    await expectToolDock(page);

    // Rule 4 — the Pan tool is deleted; Select is in the dock.
    await expect(page.getByTestId("canvas-tool-pan")).toHaveCount(0);
    await expect(page.getByTestId("canvas-tool-select")).toBeVisible();

    const item = page.getByTestId("studio-item").first();
    await expect(item).toBeVisible({ timeout: 15_000 });

    // Rule 2 — arm Trace, click the object: it stays inert (not selected),
    // and the one-time "drop the tool" hint surfaces instead.
    await page.getByTestId("canvas-tool-trace").click();
    await item.dispatchEvent("pointerdown");
    await item.dispatchEvent("pointerup");
    await expect(item).toHaveAttribute("data-selected", "false");
    await expect(page.getByTestId("select-hint")).toBeVisible({
      timeout: 5_000,
    });

    // Rule 3 — Esc returns to the Select ground state; the click now selects.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("canvas-tool-select")).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 5_000 },
    );
    await item.dispatchEvent("pointerdown");
    await item.dispatchEvent("pointerup");
    await expect(item).toHaveAttribute("data-selected", "true", {
      timeout: 5_000,
    });
  });
});
