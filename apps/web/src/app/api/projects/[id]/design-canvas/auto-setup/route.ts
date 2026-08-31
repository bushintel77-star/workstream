import { NextRequest, NextResponse } from "next/server";
import {
  SketchCanvasSchema,
  SetbackLineSchema,
  BuildingFootprintSchema,
} from "@workstream/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * AI Automated Site Setup — MOCK endpoint (Phase 7).
 *
 * This route simulates a WFS / AI vision-model pipeline that ingests a
 * topographic survey PDF + cadastral title and returns:
 *   - A topographic stack of 3 SketchCanvas planes (Ground / Terrace / Upper)
 *   - Legal setback lines as a 2D inset rectangle on the ground plane
 *   - A building footprint extruded to 3.5 m to frame the negative garden space
 *
 * The mock enforces a 3-second processing delay to exercise the UI loading
 * states. The response is validated against the Zod contracts before return.
 *
 * SEAM: swap the mock body for a real WFS / vision-model call (Vicmap WFS,
 * OpenAI GPT-4o, Claude 3.5 Sonnet, etc.) when API keys are provisioned.
 * The contract validation stays — it is the boundary that protects the store.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { error: "Missing project — cannot run site setup" },
      { status: 400 },
    );
  }

  // Parse the multipart form (survey + title files). The mock does not
  // process the file bytes — it only acknowledges their presence.
  let surveyPresent = false;
  let titlePresent = false;
  try {
    const formData = await req.formData();
    surveyPresent = formData.has("survey");
    titlePresent = formData.has("title");
  } catch {
    // Non-multipart body (e.g., a bare POST from "SYNC SITE TRUTH") — still
    // return the mock so the pipeline can be exercised without a real file.
  }

  // Mock processing delay — simulates WFS fetch + AI vision inference time.
  await new Promise((resolve) => setTimeout(resolve, 3_000));

  // --- Build the simulated GIS / AI payload ---

  // Three topographic canvases: Ground (Z=0), Terrace (Z=1.5), Upper (Z=3.0).
  // Identity quaternion [0, 0, 0, 1] — horizontal planes facing up.
  const mockCanvases = [
    {
      id: crypto.randomUUID(),
      label: "Ground",
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0, 1] as [number, number, number, number],
      season_tag: "ALL" as const,
    },
    {
      id: crypto.randomUUID(),
      label: "Terrace",
      position: [0, 1.5, 0] as [number, number, number],
      rotation: [0, 0, 0, 1] as [number, number, number, number],
      season_tag: "ALL" as const,
    },
    {
      id: crypto.randomUUID(),
      label: "Upper",
      position: [0, 3.0, 0] as [number, number, number],
      rotation: [0, 0, 0, 1] as [number, number, number, number],
      season_tag: "ALL" as const,
    },
  ];

  // Setback lines — a simple inset rectangle representing legal non-build
  // zones (10% inset from each board edge). Closed ring (5 points).
  const inset = 10;
  const setbackRing = [
    { x_pct: inset, y_pct: inset },
    { x_pct: 100 - inset, y_pct: inset },
    { x_pct: 100 - inset, y_pct: 100 - inset },
    { x_pct: inset, y_pct: 100 - inset },
    { x_pct: inset, y_pct: inset },
  ];

  const mockSetbackLines = [
    {
      id: crypto.randomUUID(),
      points: setbackRing,
      label: "Legal setback — non-build zone",
    },
  ];

  // Building footprint — a simple rectangle near the center of the lot
  // representing the dwelling. Extruded to 3.5 m in the R3F scene to frame
  // the negative garden space.
  const mockBuildingFootprints = [
    {
      id: crypto.randomUUID(),
      points: [
        { x_pct: 35, y_pct: 30 },
        { x_pct: 65, y_pct: 30 },
        { x_pct: 65, y_pct: 55 },
        { x_pct: 35, y_pct: 55 },
      ],
      height_m: 3.5,
      label: "Dwelling",
    },
  ];

  // --- Validate the payload against the Zod contracts before returning ---
  // Uses the schema's own .array() method (no direct zod import needed —
  // the web app gets zod transitively through @workstream/contracts).
  const canvasesResult = SketchCanvasSchema.array().safeParse(mockCanvases);
  if (!canvasesResult.success) {
    return NextResponse.json(
      {
        error: "Mock canvases failed contract validation",
        issues: canvasesResult.error.issues,
      },
      { status: 500 },
    );
  }

  const setbackResult = SetbackLineSchema.array().safeParse(mockSetbackLines);
  if (!setbackResult.success) {
    return NextResponse.json(
      {
        error: "Mock setback lines failed contract validation",
        issues: setbackResult.error.issues,
      },
      { status: 500 },
    );
  }

  const footprintResult =
    BuildingFootprintSchema.array().safeParse(mockBuildingFootprints);
  if (!footprintResult.success) {
    return NextResponse.json(
      {
        error: "Mock building footprints failed contract validation",
        issues: footprintResult.error.issues,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    canvases: canvasesResult.data,
    setback_lines: setbackResult.data,
    building_footprints: footprintResult.data,
    sources: { survey: surveyPresent, title: titlePresent },
  });
}
