import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { handoffStudio } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

/**
 * Kept Tier-1 Quote smoke — Wrights Terrace address gate + savings ledger
 * target ($58,410) on the handoff Quote surface.
 *
 * Gate must use the project create address (not STUDIO_SITES seed label),
 * otherwise every project would show the Tier-1 ledger.
 */
test.describe("Tier-1 Quote ledger", () => {
  test("Wrights Prahran shows ledger target on Quote with a costed BOM", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "36 Wrights Terrace, Prahran VIC 3181",
        lat: -37.849,
        lng: 144.993,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    const survey = await request.post(`${API}/projects/${projectId}/survey`);
    expect(survey.ok()).toBeTruthy();

    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: randomUUID(),
              symbol_id: "bluestone-paver",
              x_pct: 42,
              y_pct: 48,
              rotation_deg: 0,
              scale: 1,
            },
          ],
          strokes: [],
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=quote`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(handoffStudio(page)).toHaveAttribute(
      "data-canvas-mode",
      "quote",
    );
    await expect(page.getByTestId("quote-surface")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("quote-empty-state")).toHaveCount(0);
    await expect(page.getByTestId("tier1-quote-ledger")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("tier1-quote-target")).toContainText(
      /Target quote \$58,410/,
    );
  });

  test("non-Wrights address does not show the Tier-1 ledger", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "3 Test St, Carlton VIC 3053",
        lat: -37.8,
        lng: 144.96,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    await request.post(`${API}/projects/${projectId}/survey`);
    await request.put(`${API}/projects/${projectId}/design-canvas`, {
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

    await page.goto(`/projects/${projectId}?mode=quote`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("quote-surface")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("tier1-quote-ledger")).toHaveCount(0);
  });
});
