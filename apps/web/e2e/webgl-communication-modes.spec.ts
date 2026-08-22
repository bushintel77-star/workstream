import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createAddressProject } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

async function seedCanvas(
  projectId: string,
  request: APIRequestContext,
  northBearing?: number | null,
) {
  const res = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [
        {
          id: randomUUID(),
          symbol_id: "lophostemon-confertus",
          x_pct: 45,
          y_pct: 58,
          rotation_deg: 0,
          scale: 1,
        },
        {
          id: randomUUID(),
          symbol_id: "led-bollard-light",
          x_pct: 70,
          y_pct: 42,
          rotation_deg: 0,
          scale: 1,
        },
      ],
      strokes: [],
      features: [
        {
          id: randomUUID(),
          type: "LandscapeFeature",
          metadata: {
            layer: "hardscape",
            timestamp_created: new Date().toISOString(),
            source_attribution: "human_drawn",
            user_modification_state: "accepted",
          },
          geometry: {
            type: "Polygon",
            spatial_reference: "EPSG:3857",
            canvas_origin_pct: { x_pct: 0, y_pct: 0 },
            points: [
              { id: "a", pct: { x_pct: 35, y_pct: 60 } },
              { id: "b", pct: { x_pct: 60, y_pct: 60 } },
              { id: "c", pct: { x_pct: 60, y_pct: 75 } },
              { id: "d", pct: { x_pct: 35, y_pct: 75 } },
            ],
          },
          material_fill: {
            type: "surface",
            sku: "bluestone-paver",
            depth_m: 0.06,
            waste_allocation_pct: 10,
          },
        },
      ],
      irrigation_zones: [
        {
          id: randomUUID(),
          name: "Lawn south",
          kind: "spray",
          emitter_spacing_cm: 30,
          emitter_flow_lph: 2.2,
          points: [
            { x_pct: 22, y_pct: 62 },
            { x_pct: 42, y_pct: 62 },
            { x_pct: 42, y_pct: 80 },
          ],
        },
      ],
      construction_trenches: [
        {
          id: randomUUID(),
          name: "Drain spine",
          kind: "drainage",
          source: "traced",
          depth_mm: 450,
          points: [
            { x_pct: 25, y_pct: 48 },
            { x_pct: 50, y_pct: 58 },
          ],
        },
      ],
      site_frame: {
        boundary: [
          { x_pct: 15, y_pct: 12 },
          { x_pct: 85, y_pct: 12 },
          { x_pct: 85, y_pct: 88 },
          { x_pct: 15, y_pct: 88 },
        ],
        building: [
          { x_pct: 35, y_pct: 20 },
          { x_pct: 65, y_pct: 20 },
          { x_pct: 65, y_pct: 34 },
          { x_pct: 35, y_pct: 34 },
        ],
        building_source: "traced",
        easements: [],
        services: [],
        levels: [
          { x_pct: 24, y_pct: 26, z_m: 100.5, source: "authored" },
          { x_pct: 70, y_pct: 70, z_m: 99.9, source: "vicmap_contour" },
        ],
        north_bearing: northBearing ?? undefined,
      },
    },
  });
  expect(res.ok()).toBeTruthy();
}

async function contrastRatioFor(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const parse = (c: string): [number, number, number, number] => {
      const m = c.match(/[\d.]+/g);
      if (!m) return [0, 0, 0, 0];
      return [
        Number(m[0]),
        Number(m[1]),
        Number(m[2]),
        m[3] == null ? 1 : Number(m[3]),
      ];
    };
    const over = (
      fg: [number, number, number, number],
      bg: [number, number, number, number],
    ): [number, number, number, number] => {
      const a = fg[3];
      return [
        fg[0] * a + bg[0] * (1 - a),
        fg[1] * a + bg[1] * (1 - a),
        fg[2] * a + bg[2] * (1 - a),
        1,
      ];
    };
    const lum = (c: [number, number, number, number]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const ratio = (a: [number, number, number, number], b: [number, number, number, number]) => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    let bg: [number, number, number, number] = [255, 255, 255, 1];
    let cur: Element | null = el;
    while (cur) {
      const next = parse(getComputedStyle(cur).backgroundColor);
      if (next[3] > 0) bg = over(next, bg);
      if (next[3] >= 1) break;
      cur = cur.parentElement;
    }
    return ratio(over(fg, bg), bg);
  }, selector);
}

test.describe("WebGL communication modes", () => {
  test.setTimeout(180_000);

  test("Survey default is technical and switch keeps data references stable", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "4 Communication Test Street, Prahran VIC 3181",
    });
    await seedCanvas(projectId, request);

    await page.goto(`/projects/${projectId}?mode=survey`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("survey-communication-card")).toBeVisible();
    await expect(
      page.getByTestId("survey-communication-mode-technical"),
    ).toHaveAttribute("aria-pressed", "true");

    const firstBoundary = page.getByTestId("annotation-boundary-label").first();
    await expect(firstBoundary).toBeVisible();
    const baseline = (await firstBoundary.textContent())?.trim();

    await page.getByTestId("survey-communication-mode-architectural").click();
    await expect(
      page.getByTestId("survey-communication-mode-architectural"),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(firstBoundary).toHaveText(baseline ?? "");
  });

  test("CAD and Sketch mode defaults are architectural and creative", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "5 CAD Sketch Communication Street, Prahran VIC 3181",
    });
    await seedCanvas(projectId, request);

    await page.goto(`/projects/${projectId}?mode=cad`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("survey-communication-card")).toBeVisible();
    await expect(
      page.getByTestId("survey-communication-mode-architectural"),
    ).toHaveAttribute("aria-pressed", "true");

    await page.goto(`/projects/${projectId}?mode=sketch`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("survey-communication-card")).toBeVisible();
    await expect(
      page.getByTestId("survey-communication-mode-creative"),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("survey-communication-mode-technical").click();
    await expect(
      page.getByTestId("survey-communication-mode-technical"),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("trade packs toggle legend and overlays", async ({ page, request }) => {
    const { projectId } = await createAddressProject(request, {
      address: "6 Trade Communication Street, Prahran VIC 3181",
    });
    await seedCanvas(projectId, request);

    await page.goto(`/projects/${projectId}?mode=survey`, { waitUntil: "networkidle" });
    const card = page.getByTestId("survey-communication-card");
    await expect(card).toBeVisible();
    await expect(card.getByTestId("trade-pack-irrigationDrainage")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator('[data-testid="trade-callout-irrigationDrainage"]').first()).toBeVisible();
    await expect(
      page.locator('[data-testid="trade-callout-hardscapeConstruction"]').first(),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("survey-communication-legend")
        .getByText("Irrigation and drainage"),
    ).toBeVisible();
    await expect(card.getByTestId("trade-pack-lightingElectrical")).toBeVisible();
    await card.getByTestId("trade-pack-lightingElectrical").click();
    await expect(card.getByTestId("trade-pack-lightingElectrical")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.locator('[data-testid="trade-callout-lightingElectrical"]').first(),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("survey-communication-legend")
        .getByText("Lighting electrical"),
    ).toBeVisible();

    await card.getByTestId("trade-pack-irrigationDrainage").click();
    await expect(card.getByTestId("trade-pack-irrigationDrainage")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page.locator('[data-testid="trade-callout-irrigationDrainage"]')).toHaveCount(
      0,
    );
  });

  test("north calibration truth and annotation label contrast remain explicit", async ({
    page,
    request,
  }) => {
    const { projectId: calibratedId } = await createAddressProject(request, {
      address: "7 North Calibration Street, Prahran VIC 3181",
    });
    await seedCanvas(calibratedId, request, 37.5);
    await page.goto(`/projects/${calibratedId}?mode=survey`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("survey-communication-card")).toBeVisible();
    const power = page
      .getByTestId("survey-communication-card")
      .getByRole("button", { name: /^(On|Off)$/ });
    if ((await power.getAttribute("aria-pressed")) !== "true") {
      await power.click();
    }
    await expect(page.getByTestId("annotation-north-indicator")).toHaveAttribute(
      "aria-label",
      /calibrated at 37\.5/,
    );
    await expect(
      page.getByTestId("survey-communication-legend").getByText("37.5° true"),
    ).toBeVisible();

    const { projectId: uncalibratedId } = await createAddressProject(request, {
      address: "8 Indicative North Street, Prahran VIC 3181",
    });
    await seedCanvas(uncalibratedId, request, null);
    await page.goto(`/projects/${uncalibratedId}?mode=survey`, { waitUntil: "networkidle" });
    const power2 = page
      .getByTestId("survey-communication-card")
      .getByRole("button", { name: /^(On|Off)$/ });
    if ((await power2.getAttribute("aria-pressed")) !== "true") {
      await power2.click();
    }
    await expect(page.getByTestId("annotation-north-indicator")).toHaveAttribute(
      "aria-label",
      /uncalibrated and indicative/,
    );
    await expect(
      page.getByTestId("survey-communication-legend").getByText("Uncalibrated — locational-indicative"),
    ).toBeVisible();

    const boundaryRatio = await contrastRatioFor(page, '[data-testid="annotation-boundary-label"]');
    const calloutToggle = page.getByTestId("survey-communication-filter-callouts");
    if ((await calloutToggle.getAttribute("aria-pressed")) !== "true") {
      await calloutToggle.click();
    }
    await expect(page.locator('[title^="D-0"]').first()).toBeVisible();
    const calloutRatio = await contrastRatioFor(page, '[title^="D-0"]');
    expect(boundaryRatio).not.toBeNull();
    expect(calloutRatio).not.toBeNull();
    expect(boundaryRatio!).toBeGreaterThanOrEqual(4.5);
    expect(calloutRatio!).toBeGreaterThanOrEqual(4.5);
  });
});
