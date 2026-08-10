import { expect, test } from "@playwright/test";
import { handoffStudio, openCommandPalette } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

test.describe("Canvas foundation honesty", () => {
  test("real title without building never displays the demo footprint", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Empty Footprint, 18 Honest Lane, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    const canvas = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [],
          irrigation_zones: [],
          site_frame: {
            boundary: [
              { x_pct: 12, y_pct: 12 },
              { x_pct: 88, y_pct: 12 },
              { x_pct: 88, y_pct: 88 },
              { x_pct: 12, y_pct: 88 },
            ],
            building: [],
            easements: [],
            services: [],
            levels: [],
          },
        },
      },
    );
    expect(canvas.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("building-footprint")).toHaveCount(0);
    await expect(page.getByTestId("building-footprint-empty")).toContainText(
      "Existing dwelling outline unavailable",
      { timeout: 15_000 },
    );
    // Checklist is collapsed by default (§6 item 7) — summon via progress pill.
    await expect(page.getByTestId("right-data-lane-collapsed")).toHaveCount(1);
    await page.getByTestId("survey-progress-pill").click();
    await expect(page.getByTestId("survey-checklist")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Close checklist" }).click();
    await expect(page.getByTestId("cad-title-area")).toBeVisible();
    await expect(page.getByTestId("cad-building-area")).toHaveCount(0);
  });

  test("CAD area labels and summary stay synced with measured geometry", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Measured Areas, 20 Honest Lane, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    // Aerial unlocks CAD on the server; without survey, ?mode=cad clamps to survey.
    const survey = await request.post(`${API}/projects/${projectId}/survey`);
    expect(survey.ok()).toBeTruthy();

    const canvas = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [],
          irrigation_zones: [],
          site_frame: {
            boundary: [
              { x_pct: 10, y_pct: 10 },
              { x_pct: 90, y_pct: 10 },
              { x_pct: 90, y_pct: 90 },
              { x_pct: 10, y_pct: 90 },
            ],
            building: [
              { x_pct: 35, y_pct: 30 },
              { x_pct: 65, y_pct: 30 },
              { x_pct: 65, y_pct: 55 },
              { x_pct: 35, y_pct: 55 },
            ],
            easements: [],
            services: [],
            levels: [],
          },
        },
      },
    );
    expect(canvas.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toHaveAttribute(
      "data-mode",
      "cad",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("cad-title-area")).toBeVisible();
    await expect(page.getByTestId("cad-building-area")).toBeVisible();
    await expect(page.getByTestId("cad-outdoor-area")).toBeVisible();

    await openCommandPalette(page);
    await page.getByTestId("canvas-command-measures").click();
    await expect(page.getByTestId("live-measures-rail")).toBeVisible();
    await expect(page.getByTestId("live-measure-building")).toBeVisible();
    await expect(page.getByTestId("live-measure-outdoor")).toBeVisible();
  });

  test("quiet Vicmap hydrate never leaves the demo seed dwelling on a live project", async ({
    page,
    request,
  }) => {
    // Melbourne CBD — Vicmap may or may not return a building; either way
    // the Wrights seed parallelogram must not remain after parcel snap.
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Vicmap Dwelling, 1 Swanston St, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    // Ensure survey (and house_polygon when available) exists before studio mount.
    const survey = await request.post(`${API}/projects/${projectId}/survey`);
    expect(survey.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    // Wait for quiet hydrate to finish (boundary source flips off seed).
    await expect
      .poll(
        async () =>
          page
            .locator("[data-testid=building-footprint], [data-testid=building-footprint-empty]")
            .count(),
        { timeout: 25_000 },
      )
      .toBeGreaterThan(0);

    const footprint = page.getByTestId("building-footprint");
    const empty = page.getByTestId("building-footprint-empty");
    if ((await footprint.count()) > 0) {
      // Real Vicmap (or survey) house — must be labelled honestly, not seed.
      await expect(footprint).toHaveAttribute("data-building-source", "vicmap");
      const box = await footprint.boundingBox();
      expect(box).toBeTruthy();
      // Seed Wrights dwelling is a tall thin strip; Vicmap houses are not that ratio
      // after a real parcel fit — guard against the classic seed warp.
      const ratio = box!.height / Math.max(1, box!.width);
      expect(ratio).toBeLessThan(8);
    } else {
      await expect(empty).toBeVisible();
      await expect(empty).toContainText("Existing dwelling outline unavailable");
    }
  });
});
