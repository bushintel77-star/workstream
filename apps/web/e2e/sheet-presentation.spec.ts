import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

/**
 * Fit-sheet presentation compose — header-summoned peel (canvas-first).
 */
test.describe("Fit sheet presentation compose", () => {
  test("Fit seeds brochure on paper; compose summons from header", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("fit-sheet-top").click();
    await expect(page.getByTestId("fit-sheet-layer")).toBeVisible({
      timeout: 10_000,
    });

    // Canvas-first: no compose chrome until the header icon is pressed.
    await expect(page.getByTestId("sheet-compose-dock")).toHaveCount(0);
    await expect(page.getByTestId("sheet-compose-top")).toBeVisible();

    // Brochure lands on the paper without summoning compose.
    await expect(page.getByTestId("sheet-on-quote_total")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("sheet-on-honesty_footer")).toHaveCount(0);
    await expect(page.getByTestId("sheet-zone-face")).toBeVisible();

    await page.getByTestId("sheet-compose-top").click();
    await expect(page.getByTestId("sheet-compose-dock")).toBeVisible();
    await expect(page.getByTestId("sheet-compose-peel")).toBeVisible();
    await expect(page.locator("select")).toHaveCount(0);
    await expect(
      page.getByTestId("sheet-template-curtis-client-brochure"),
    ).toHaveAttribute("data-on", "1");

    await page.getByTestId("sheet-theme-blush").click();
    await expect(page.getByTestId("fit-sheet-frame")).toHaveAttribute(
      "data-sheet-theme",
      "blush",
    );

    await page.getByTestId("sheet-reflow").click();
    await expect(page.getByTestId("sheet-widgets-side_stack")).toBeVisible();

    await expect(
      page.locator('[data-testid="zoom-world"] [data-camera-chrome]'),
    ).toHaveCount(0);

    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${API}/projects/${projectId}/design-canvas`,
          );
          if (!res.ok()) return null;
          const body = (await res.json()) as {
            canvas?: {
              presentation_pack?: { theme?: string; template_id?: string };
            };
          };
          return body.canvas?.presentation_pack ?? null;
        },
        { timeout: 20_000 },
      )
      .toMatchObject({
        theme: "blush",
        template_id: "curtis-client-brochure",
      });

    // Persist check via API — avoid Fit toggle races after reload.
    const reload = await request.get(
      `${API}/projects/${projectId}/design-canvas`,
    );
    expect(reload.ok()).toBeTruthy();
    const saved = (await reload.json()) as {
      canvas?: { presentation_pack?: { theme?: string } };
    };
    expect(saved.canvas?.presentation_pack?.theme).toBe("blush");
  });
});
