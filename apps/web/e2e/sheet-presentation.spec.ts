import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

/**
 * Fit-sheet presentation compose — canvas feature (templates + widgets).
 */
test.describe("Fit sheet presentation compose", () => {
  test("Fit sheet opens compose dock; brochure seeds; pack persists", async ({
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
    await expect(page.getByTestId("sheet-compose-dock")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("sheet-compose-chrome")).toBeVisible();

    // Empty pack auto-seeds the client brochure on first Fit open.
    await expect(page.getByTestId("sheet-on-quote_total")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("sheet-on-honesty_footer")).toBeVisible();
    await expect(page.getByTestId("sheet-zone-face")).toBeVisible();
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

    // Camera chrome must portal beside zoom-world, not scale with it.
    await expect(
      page.locator('[data-testid="zoom-world"] [data-camera-chrome]'),
    ).toHaveCount(0);
    await expect(
      page.locator(
        '[data-testid="camera-chrome-root"] [data-testid="sheet-compose-chrome"]',
      ),
    ).toHaveCount(1);

    // Wait for durable autosave of presentation_pack, then reload.
    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${API}/projects/${projectId}/design-canvas`,
          );
          if (!res.ok()) return null;
          const body = (await res.json()) as {
            canvas?: { presentation_pack?: { theme?: string; widgets?: unknown[] } };
          };
          return body.canvas?.presentation_pack ?? null;
        },
        { timeout: 20_000 },
      )
      .toMatchObject({
        theme: "blush",
        template_id: "curtis-client-brochure",
      });

    await page.reload();
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("fit-sheet-top").click();
    await expect(page.getByTestId("fit-sheet-frame")).toHaveAttribute(
      "data-sheet-theme",
      "blush",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("sheet-on-quote_total")).toBeVisible();
    await expect(
      page.getByTestId("sheet-template-curtis-client-brochure"),
    ).toHaveAttribute("data-on", "1");
  });
});
