import { expect, test } from "@playwright/test";
import { createSurveyProject } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

test.describe("Present surface states", () => {
  test("empty deck surface exposes data-surface-state=empty", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    // Present unlocks once CAD has accepted geometry — seed a live placement.
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: "a0000000-0000-4000-8000-00000000e201",
              symbol_id: "bluestone-paver",
              x_pct: 45,
              y_pct: 55,
              rotation_deg: 0,
              scale: 1,
              label: "paving",
            },
          ],
          site_frame: {
            boundary: [
              { x_pct: 18, y_pct: 16 },
              { x_pct: 82, y_pct: 16 },
              { x_pct: 82, y_pct: 84 },
              { x_pct: 18, y_pct: 84 },
            ],
            building: [
              { x_pct: 28, y_pct: 22 },
              { x_pct: 62, y_pct: 22 },
              { x_pct: 62, y_pct: 48 },
              { x_pct: 28, y_pct: 48 },
            ],
            building_source: "traced",
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=present`);
    const surface = page.getByTestId("present-surface");
    await expect(surface).toBeVisible({ timeout: 30_000 });
    await expect(surface).toHaveAttribute("data-surface-state", "empty");
    await expect(page.getByTestId("present-surface-banner")).toHaveAttribute(
      "data-state",
      "empty",
    );
    await expect(page.getByTestId("present-empty-workspace")).toBeVisible();
  });

  test("issued deck surfaces data-surface-state=locked", async ({
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
              id: "a0000000-0000-4000-8000-00000000e202",
              symbol_id: "bluestone-paver",
              x_pct: 45,
              y_pct: 55,
              rotation_deg: 0,
              scale: 1,
              label: "paving",
            },
          ],
          site_frame: {
            boundary: [
              { x_pct: 18, y_pct: 16 },
              { x_pct: 82, y_pct: 16 },
              { x_pct: 82, y_pct: 84 },
              { x_pct: 18, y_pct: 84 },
            ],
            building: [
              { x_pct: 28, y_pct: 22 },
              { x_pct: 62, y_pct: 22 },
              { x_pct: 62, y_pct: 48 },
              { x_pct: 28, y_pct: 48 },
            ],
            building_source: "traced",
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    const create = await request.post(
      `${API}/projects/${projectId}/presentation-documents`,
      { data: { title: "Issued meeting pack" } },
    );
    expect(create.ok()).toBeTruthy();
    const created = (await create.json()) as { document: { id: string } };

    const issue = await request.put(
      `${API}/projects/${projectId}/presentation-documents/${created.document.id}`,
      { data: { status: "issued" } },
    );
    expect(issue.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=present`);
    await expect(page.getByTestId("present-surface")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("present-surface")).toHaveAttribute(
      "data-surface-state",
      "locked",
    );
    await expect(page.getByTestId("present-surface-banner")).toHaveAttribute(
      "data-state",
      "locked",
    );
    await expect(page.getByTestId("present-issued-badge")).toBeVisible();
    await expect(page.getByTestId("issue-deck-btn")).toHaveCount(0);
    await expect(page.getByTestId("add-plan-crop-btn")).toBeDisabled();
    await expect(page.getByTestId("present-page-canvas")).toHaveAttribute(
      "data-drafting-suspended",
      "1",
    );
  });

  test("Issue from toolbar freezes the active draft deck", async ({
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
              id: "a0000000-0000-4000-8000-00000000e203",
              symbol_id: "bluestone-paver",
              x_pct: 45,
              y_pct: 55,
              rotation_deg: 0,
              scale: 1,
              label: "paving",
            },
          ],
          site_frame: {
            boundary: [
              { x_pct: 18, y_pct: 16 },
              { x_pct: 82, y_pct: 16 },
              { x_pct: 82, y_pct: 84 },
              { x_pct: 18, y_pct: 84 },
            ],
            building: [
              { x_pct: 28, y_pct: 22 },
              { x_pct: 62, y_pct: 22 },
              { x_pct: 62, y_pct: 48 },
              { x_pct: 28, y_pct: 48 },
            ],
            building_source: "traced",
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    const create = await request.post(
      `${API}/projects/${projectId}/presentation-documents`,
      { data: { title: "Issue from UI" } },
    );
    expect(create.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=present`);
    await expect(page.getByTestId("present-surface")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("present-surface")).toHaveAttribute(
      "data-surface-state",
      "ready",
    );

    await page.getByTestId("issue-deck-btn").click();
    await page.getByTestId("issue-deck-confirm").click();

    await expect(page.getByTestId("present-surface")).toHaveAttribute(
      "data-surface-state",
      "locked",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("present-page-paper")).toHaveAttribute(
      "data-palette",
      "stone",
    );
    await expect(page.getByTestId("dissect-plan-btn")).toBeDisabled();
  });
});
