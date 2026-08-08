import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * AS 4970-2025 — seeded exist tree with DBH draws NRZ + SRZ rings on CAD.
 */
test.describe("AS 4970 NRZ/SRZ rings", () => {
  test("exist tree with DBH shows NRZ and SRZ rings", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: randomUUID(),
              symbol_id: "existing-tree-retain",
              x_pct: 48,
              y_pct: 52,
              rotation_deg: 0,
              scale: 1,
              label: "exist:dbh=0.45",
              source: "operator",
            },
          ],
          strokes: [],
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    const nrz = page.getByTestId("exist-tpz-ring").first();
    await expect(nrz).toBeVisible({ timeout: 20_000 });
    await expect(nrz).toHaveAttribute("data-nrz-m", "5.4");
    await expect(nrz).toHaveAttribute("data-srz-m", /\d+\.\d/);

    const srz = page.getByTestId("exist-srz-ring").first();
    await expect(srz).toBeVisible();
  });
});
