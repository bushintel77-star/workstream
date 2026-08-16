import { expect, test } from "@playwright/test";
import { handoffStudio } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Vicmap-locked titles must not paint neighbour-lot “skin” beside the
 * drawing in Sketch/CAD. Those fills were Stage-1 foundation chrome only.
 */
test.describe("Neighbour lot skin", () => {
  test("Vicmap Wrights Sketch/CAD has zero cad-context-lot panels", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "36 Wrights Terrace, Prahran VIC 3181",
        lat: -37.85,
        lng: 145.0,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    const survey = await request.post(`${API}/projects/${projectId}/survey`);
    expect(survey.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?svg=1&mode=sketch`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 20_000,
    });

    // Vicmap hydrate may lock the title; skin must still stay off.
    await expect
      .poll(async () => page.getByTestId("cad-plan-board").count(), {
        timeout: 20_000,
      })
      .toBe(1);
    await expect(page.getByTestId("cad-context-lot")).toHaveCount(0);

    await page.getByRole("button", { name: "Cad" }).click();
    await expect(handoffStudio(page)).toHaveAttribute(
      "data-canvas-mode",
      "cad",
    );
    await expect(page.getByTestId("cad-context-lot")).toHaveCount(0);
  });
});
