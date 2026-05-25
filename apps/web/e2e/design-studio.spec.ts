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
        irrigation_zones: [],
      },
    });
    expect(seed.ok()).toBeTruthy();
  });

  test("loads immersive pipeline shell and aerial canvas", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    const shell = page.getByTestId("project-pipeline-shell");
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell).toHaveAttribute("data-shell-variant", "immersive");
    await expect(page.getByTestId("pipeline-tab-design")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("design-studio-image-shell")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("design-studio-counts")).toHaveText(/1 symbols/, {
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Place", exact: true }).click();
    await expect(page.getByTestId("design-asset-palette")).toBeVisible();
    await expect(page.getByTestId("catalog-bluestone-paver")).toBeVisible();
    await expect(page.getByTestId("design-studio-save")).toBeVisible();
  });

  test("shows indicative scale bar on canvas", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await expect(page.getByTestId("design-studio-scale-bar")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("design-studio-scale-bar")).toContainText(/m/);
  });

  test("places symbol from catalog click", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await expect(page.getByTestId("design-studio-counts")).toHaveText(/1 symbols/, {
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Place", exact: true }).click();
    await page.getByTestId("catalog-lomandra-mass").click();
    const canvas = page.getByTestId("design-studio-canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await canvas.click({
      position: { x: (box?.width ?? 400) / 2, y: (box?.height ?? 280) / 2 },
    });
    await expect(page.getByTestId("design-studio-counts")).toHaveText(/2 symbols/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("canvas-placement")).toHaveCount(2);
  });

  test("opens schedule and irrigation panels", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await page.getByRole("tab", { name: "Schedule" }).click();
    await expect(page.getByTestId("studio-schedule-panel")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("tab", { name: "Irrigation" }).click();
    await expect(page.getByTestId("studio-irrigation-panel")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("legacy studio URL redirects to design", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design/studio`);
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/design$`));
    await expect(page.getByTestId("project-pipeline-shell")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("save plan from toolbar", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await expect(page.getByTestId("design-studio-save")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("design-studio-save").click();
    await expect(page.getByTestId("design-studio-save-status")).toHaveText(/Saved/, {
      timeout: 15_000,
    });
  });

  test("mass plant fill increases symbol count", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Mass plant", exact: true }).click();
    await page.getByRole("button", { name: "Draw bed", exact: true }).click();

    const canvas = page.getByTestId("design-studio-canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const w = box?.width ?? 400;
    const h = box?.height ?? 280;
    await canvas.click({ position: { x: w * 0.25, y: h * 0.25 } });
    await canvas.click({ position: { x: w * 0.55, y: h * 0.25 } });
    await canvas.click({ position: { x: w * 0.55, y: h * 0.55 } });

    await page.getByRole("button", { name: "Finish bed", exact: true }).click();
    await page.getByRole("button", { name: "Fill area", exact: true }).click();

    await expect(page.getByTestId("design-studio-counts")).toHaveText(/[2-9]\d* symbols/, {
      timeout: 15_000,
    });
  });

  test("irrigation zone updates schedule with drip line SKU", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("tab", { name: "Irrigation" }).click();
    await page.getByRole("button", { name: "New zone", exact: true }).click();

    const canvas = page.getByTestId("design-studio-canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const w = box?.width ?? 400;
    const h = box?.height ?? 280;
    await canvas.click({ position: { x: w * 0.2, y: h * 0.6 } });
    await canvas.click({ position: { x: w * 0.7, y: h * 0.6 } });

    await page.getByRole("button", { name: "Finish line", exact: true }).click();
    await page.getByRole("button", { name: "Summary", exact: true }).click();
    await expect(page.getByText(/Valves needed:/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("tab", { name: "Schedule" }).click();
    await expect(page.getByTestId("schedule-sku-IRR-DRIP")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("undo reverses mass plant fill in one step", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({ timeout: 30_000 });

    const counts = page.getByTestId("design-studio-counts");
    await page.getByRole("button", { name: "Mass plant", exact: true }).click();
    await page.getByRole("button", { name: "Draw bed", exact: true }).click();

    const canvas = page.getByTestId("design-studio-canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const w = box?.width ?? 400;
    const h = box?.height ?? 280;
    await canvas.click({ position: { x: w * 0.3, y: h * 0.3 } });
    await canvas.click({ position: { x: w * 0.6, y: h * 0.3 } });
    await canvas.click({ position: { x: w * 0.6, y: h * 0.6 } });
    await page.getByRole("button", { name: "Finish bed", exact: true }).click();
    await page.getByRole("button", { name: "Fill area", exact: true }).click();
    await expect(counts).toHaveText(/[3-9]\d* symbols/, { timeout: 15_000 });

    await page.getByTestId("design-studio-undo").click();
    await expect(counts).toHaveText(/1 symbols/, { timeout: 15_000 });
  });

  test("shows Tier-1 banner for Wrights Terrace address", async ({ request, page }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "36 Wrights Terrace, Prahran VIC 3181",
        lat: -37.8512,
        lng: 145.001,
      },
    });
    expect(create.ok()).toBeTruthy();
    const { project } = (await create.json()) as { project: { id: string } };
    const survey = await request.post(`${API}/projects/${project.id}/survey`);
    expect(survey.ok()).toBeTruthy();

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/projects/${project.id}/design?studio=desktop`);
    await expect(page.getByTestId("studio-tier1-banner")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("studio-tier1-banner")).toContainText(
      /Architectural massing studio/i,
    );
  });

  test("save persists irrigation zones on reload", async ({ request, page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await page.getByRole("tab", { name: "Irrigation" }).click();
    await page.getByRole("button", { name: "New zone", exact: true }).click();

    const canvas = page.getByTestId("design-studio-canvas");
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await canvas.click({ position: { x: (box?.width ?? 400) * 0.15, y: (box?.height ?? 280) * 0.7 } });
    await canvas.click({ position: { x: (box?.width ?? 400) * 0.85, y: (box?.height ?? 280) * 0.7 } });
    await page.getByRole("button", { name: "Finish line", exact: true }).click();

    await expect(page.getByTestId("design-studio-counts")).toHaveText(/1 zones/, {
      timeout: 15_000,
    });

    await page.getByTestId("design-studio-save").click();
    await expect(page.getByTestId("design-studio-save-status")).toHaveText(/Saved/, {
      timeout: 15_000,
    });

    const canvasGet = await request.get(`${API}/projects/${projectId}/design-canvas`);
    expect(canvasGet.ok()).toBeTruthy();
    const body = (await canvasGet.json()) as {
      canvas: { irrigation_zones: { points: unknown[] }[] };
    };
    expect(body.canvas.irrigation_zones.length).toBeGreaterThanOrEqual(1);

    await page.reload();
    await expect(page.getByTestId("design-studio-counts")).toHaveText(/1 zones/, {
      timeout: 30_000,
    });
  });
});
