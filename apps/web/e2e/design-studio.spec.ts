import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:3001";

test.describe("Design studio", () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Design Studio, 42 Test Grove, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    projectId = body.project.id;

    const survey = await request.post(`${API}/projects/${projectId}/survey`);
    expect(survey.ok()).toBeTruthy();

    const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
      data: {
        placements: [
          {
            id: randomUUID(),
            symbol_id: "bluestone-paver",
            x_pct: 40,
            y_pct: 40,
            rotation_deg: 0,
            scale: 1,
          },
        ],
        strokes: [],
      },
    });
    expect(seed.ok()).toBeTruthy();
  });

  test("loads studio with catalog and saves canvas", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design/studio`);
    await expect(page.getByRole("heading", { name: "Design studio" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("design-asset-palette")).toBeVisible();
    await expect(page.getByTestId("catalog-bluestone-paver")).toBeVisible();
    await expect(page.getByTestId("design-studio-counts")).toHaveText(/1 symbols/, {
      timeout: 15_000,
    });

    const beforeRes = await page.request.get(
      `${API}/projects/${projectId}/design-canvas`,
    );
    expect(beforeRes.ok()).toBeTruthy();
    const before = (await beforeRes.json()) as {
      canvas: { updated_at: string | null };
    };

    const save = page.getByTestId("design-studio-save");
    await save.click();
    await expect(save).toHaveText("Save plan", { timeout: 30_000 });

    await expect
      .poll(async () => {
        const res = await page.request.get(
          `${API}/projects/${projectId}/design-canvas`,
        );
        if (!res.ok()) return null;
        const json = (await res.json()) as {
          canvas: { updated_at: string | null; placements: unknown[] };
        };
        return json.canvas.updated_at;
      })
      .not.toBe(before.canvas.updated_at);

    const afterRes = await page.request.get(
      `${API}/projects/${projectId}/design-canvas`,
    );
    expect(afterRes.ok()).toBeTruthy();
    const after = (await afterRes.json()) as {
      canvas: { placements: unknown[] };
    };
    expect(after.canvas.placements.length).toBeGreaterThanOrEqual(1);
  });
});
