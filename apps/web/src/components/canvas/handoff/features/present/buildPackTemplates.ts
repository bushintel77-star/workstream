/**
 * Build Pack Templates
 * --------------------
 * Pre-populated page structures for the two export packs:
 *
 *   Client Pack (8 pages) — visual-first, jargon-free, homeowner-facing
 *   Subcontractor Pack (12 pages) — technical specs, dimensions, quantities
 *
 * Each generator receives live data snapshots and returns a full
 * PresentationDocument pages array that the PresentSurface can mount
 * directly. The pages use the existing panel kinds (text, plan_crop,
 * widget, swatch_board) — no new rendering code needed.
 */

import type {
  PresentationPage,
  PresentationPalette,
  PresentationPanel,
  PresentationPaperSize,
  PresentationPaperOrientation,
  PlanCropReason,
} from "@workstream/contracts";
import type { EstimateSnapshot, MaterialSwatch, PlanSnapshot } from "./PresentSurface";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SiteMeta = {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  lga: string;
  parcelAreaM2: number;
  slopeDegrees: number;
  sunHours: number;
  titleRef: string;
};

export type PlantScheduleItem = {
  botanical: string;
  commonName: string;
  size: string;
  qty: number;
  spacing: string;
  rootBall: string;
};

// ---------------------------------------------------------------------------
// Helpers — thin wrappers that produce correctly-typed panel objects
// ---------------------------------------------------------------------------

function makePage(
  order: number,
  title: string,
  panels: PresentationPanel[],
  opts?: {
    paperSize?: PresentationPaperSize;
    orientation?: PresentationPaperOrientation;
  },
): PresentationPage {
  return {
    id: crypto.randomUUID(),
    order,
    paper_size: opts?.paperSize ?? "a3",
    orientation: opts?.orientation ?? "landscape",
    title_block: { title, revision: "", subtitle: "", practice: "", date_label: "", scale_label: "" },
    margins: { top_mm: 12, right_mm: 12, bottom_mm: 12, left_mm: 12 },
    panels,
  };
}

function textPanel(
  heading: string,
  body: string,
  rect: { x_pct: number; y_pct: number; w_pct: number; h_pct: number },
  role: "heading" | "subheading" | "body" | "caption" = "body",
): PresentationPanel {
  return {
    id: crypto.randomUUID(),
    kind: "text",
    heading,
    body,
    role,
    rect,
    z_index: 0,
  };
}

function planCropPanel(
  reason: PlanCropReason,
  label: string,
  rect: { x_pct: number; y_pct: number; w_pct: number; h_pct: number },
  revision = 0,
): PresentationPanel {
  return {
    id: crypto.randomUUID(),
    kind: "plan_crop",
    ref: {
      canvas_revision: revision,
      crop: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
      reason,
      label,
      synced: true,
    },
    rect,
    z_index: 0,
  };
}

function widgetPanel(
  type: "quote_total" | "savings_ledger" | "zone_summary" | "material_swatches" | "caption" | "honesty_footer" | "ops_schedule",
  rect: { x_pct: number; y_pct: number; w_pct: number; h_pct: number },
): PresentationPanel {
  return {
    id: crypto.randomUUID(),
    kind: "widget",
    widget: {
      id: crypto.randomUUID(),
      type,
      slot: "title_meta",
      order: 0,
      style: { accent: "ink", emphasis: "standard" },
    },
    rect,
    z_index: 0,
  };
}

function placeholderImagePanel(
  rect: { x_pct: number; y_pct: number; w_pct: number; h_pct: number },
): PresentationPanel {
  return {
    id: crypto.randomUUID(),
    kind: "image",
    layer: {
      id: crypto.randomUUID(),
      name: "placeholder",
      uri: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%23F4F4F4' width='1' height='1'/%3E%3C/svg%3E",
      natural_aspect: 1.5,
      x_pct: 50,
      y_pct: 50,
      width_pct: 80,
      rotation: 0,
      opacity: 0,
      visible: true,
      locked: false,
      blend_mode: "normal",
    },
    rect,
    z_index: 0,
  };
}

function swatchPanel(
  ids: string[],
  caption: string,
  rect: { x_pct: number; y_pct: number; w_pct: number; h_pct: number },
): PresentationPanel {
  return {
    id: crypto.randomUUID(),
    kind: "swatch_board",
    swatch_ids: ids,
    columns: 3,
    caption,
    rect,
    z_index: 0,
  };
}

// ---------------------------------------------------------------------------
// CLIENT BUILD PACK — 8 pages
//
// Visual-first, jargon-free, outcome + investment focused.
// ---------------------------------------------------------------------------

export function generateClientPackPages(opts: {
  site: SiteMeta;
  plan: PlanSnapshot | null;
  estimate: EstimateSnapshot | null;
  materials: MaterialSwatch[];
  projectTitle?: string;
  palette?: PresentationPalette;
}): PresentationPage[] {
  const { site, plan, estimate, materials, projectTitle } = opts;
  const addr = projectTitle || `${site.address}, ${site.suburb} ${site.state} ${site.postcode}`;
  const revision = plan?.revision ?? 0;

  return [
    // Page 1 — Cover
    makePage(0, "Cover", [
      placeholderImagePanel({ x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 60 }),
      textPanel("Landscape Design Proposal", addr, { x_pct: 8, y_pct: 65, w_pct: 84, h_pct: 10 }, "heading"),
      textPanel(
        `${site.parcelAreaM2} m²  ·  ${site.sunHours}h sun  ·  ${site.lga}`,
        "",
        { x_pct: 8, y_pct: 76, w_pct: 84, h_pct: 5 },
        "caption",
      ),
      textPanel(
        "Workstream Landscape Architecture Studio",
        `Prepared ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`,
        { x_pct: 8, y_pct: 84, w_pct: 84, h_pct: 5 },
        "caption",
      ),
    ]),

    // Page 2 — Concept Design (plan view + design blurb)
    makePage(1, "Concept Design", [
      planCropPanel("overview", "Site plan", { x_pct: 0, y_pct: 0, w_pct: 65, h_pct: 100 }, revision),
      textPanel(
        "Design Intent",
        `The design creates a seamless transition between indoor and outdoor living. The ${site.parcelAreaM2} m² site at ${site.suburb} is organised around a central garden room framed by ${materials.length > 0 ? materials[0].label : "native planting"}, providing year-round structure and seasonal interest.\n\nKey moves:\n  · Establish a level entertaining zone connected to the dwelling\n  · Layer canopy and understory planting for privacy and shade\n  · Integrate permeable hardscape to manage stormwater on-site\n  · Anchor the garden with a specimen feature tree visible from the main living areas`,
        { x_pct: 68, y_pct: 5, w_pct: 28, h_pct: 55 },
        "body",
      ),
      swatchPanel(
        materials.map((m) => m.id),
        "Material palette",
        { x_pct: 68, y_pct: 65, w_pct: 28, h_pct: 30 },
      ),
    ]),

    // Page 3 — 3D Walkthrough (placeholder — renders in WebGL on export)
    makePage(2, "3D Walkthrough", [
      placeholderImagePanel({ x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 75 }),
      textPanel(
        "Perspective View",
        "Interactive 3D walkthrough — export captures the current garden-eye viewpoint.",
        { x_pct: 8, y_pct: 78, w_pct: 84, h_pct: 15 },
        "caption",
      ),
    ]),

    // Page 4 — Plant Palette
    makePage(3, "Plant Palette", [
      textPanel(
        "Plant Palette",
        `Curated species selected for ${site.suburb} climate, soil, and sun exposure.`,
        { x_pct: 5, y_pct: 3, w_pct: 90, h_pct: 10 },
        "heading",
      ),
      placeholderImagePanel({ x_pct: 5, y_pct: 15, w_pct: 90, h_pct: 78 }),
    ]),

    // Page 5 — Material Palette
    makePage(4, "Material Palette", [
      textPanel(
        "Material Palette",
        "Hardscape materials selected for durability, aesthetics, and local availability.",
        { x_pct: 5, y_pct: 3, w_pct: 90, h_pct: 10 },
        "heading",
      ),
      swatchPanel(
        materials.map((m) => m.id),
        "",
        { x_pct: 5, y_pct: 15, w_pct: 90, h_pct: 70 },
      ),
    ]),

    // Page 6 — Investment Summary
    makePage(5, "Investment Summary", [
      textPanel(
        "Investment Summary",
        "",
        { x_pct: 8, y_pct: 5, w_pct: 84, h_pct: 8 },
        "heading",
      ),
      widgetPanel("quote_total", { x_pct: 8, y_pct: 18, w_pct: 50, h_pct: 60 }),
      textPanel(
        estimate
          ? `The investment covers all hardscape, planting, drainage, and site works shown in the concept plan. A detailed breakdown is included in the subcontractor specification pack.`
          : "Investment details will appear once the design is costed.",
        "",
        { x_pct: 55, y_pct: 18, w_pct: 38, h_pct: 60 },
        "body",
      ),
    ]),

    // Page 7 — Timeline
    makePage(6, "Timeline", [
      textPanel(
        "Project Timeline",
        "Estimated programme from design approval to practical completion.",
        { x_pct: 8, y_pct: 5, w_pct: 84, h_pct: 10 },
        "heading",
      ),
      widgetPanel("ops_schedule", { x_pct: 8, y_pct: 20, w_pct: 84, h_pct: 60 }),
    ]),

    // Page 8 — Approval & Deposit
    makePage(7, "Next Steps", [
      textPanel(
        "Approval & Next Steps",
        "",
        { x_pct: 8, y_pct: 10, w_pct: 84, h_pct: 12 },
        "heading",
      ),
      textPanel(
        `To proceed with the landscape design at ${addr}:\n\n1. Review this proposal and the concept plan\n2. Sign the design approval below\n3. A 30% deposit secures your place in the build schedule\n4. Detailed documentation and construction drawings follow within 5 business days`,
        "",
        { x_pct: 8, y_pct: 28, w_pct: 84, h_pct: 45 },
        "body",
      ),
      widgetPanel("honesty_footer", { x_pct: 8, y_pct: 78, w_pct: 84, h_pct: 15 }),
    ]),
  ];
}

// ---------------------------------------------------------------------------
// SUBCONTRACTOR BUILD PACK — 12 pages
//
// Technical specs, dimensions, quantities, construction details.
// ---------------------------------------------------------------------------

export function generateSubcontractorPackPages(opts: {
  site: SiteMeta;
  plan: PlanSnapshot | null;
  estimate: EstimateSnapshot | null;
  materials: MaterialSwatch[];
  plantSchedule?: PlantScheduleItem[];
  projectTitle?: string;
}): PresentationPage[] {
  const { site, plan, estimate, materials, plantSchedule, projectTitle } = opts;
  const addr = projectTitle || `${site.address}, ${site.suburb} ${site.state} ${site.postcode}`;
  const revision = plan?.revision ?? 0;

  return [
    // Page 1 — Site Summary
    makePage(0, "Site Summary", [
      textPanel(
        "Site Summary",
        `Address: ${addr}\nLGA: ${site.lga}\nTitle Reference: ${site.titleRef}\nSite Area: ${site.parcelAreaM2} m²\nSlope: ${site.slopeDegrees}°\nSun Window: ${site.sunHours}h`,
        { x_pct: 8, y_pct: 8, w_pct: 84, h_pct: 80 },
        "body",
      ),
    ]),

    // Page 2 — Survey Plan
    makePage(1, "Survey Plan", [
      planCropPanel("overview", "Survey boundary", { x_pct: 0, y_pct: 0, w_pct: 60, h_pct: 100 }, revision),
      textPanel(
        "Boundary Dimensions",
        plan
          ? `Boundary points: ${plan.boundary.length}\nBuilding footprint: ${plan.building.length > 0 ? "present" : "none"}\nPlacements: ${plan.items.length}\nStrokes: ${plan.strokes.length}`
          : "Survey data not yet imported.",
        { x_pct: 63, y_pct: 5, w_pct: 32, h_pct: 40 },
        "body",
      ),
      textPanel(
        "Title & Easements",
        `Title: ${site.titleRef}\nLGA: ${site.lga}\nSlope: ${site.slopeDegrees}° south`,
        { x_pct: 63, y_pct: 50, w_pct: 32, h_pct: 30 },
        "body",
      ),
    ]),

    // Page 3 — Site Sections
    makePage(2, "Site Sections", [
      textPanel(
        "Cross Sections",
        "Section cuts A-A and B-B through the site showing levels and retaining.",
        { x_pct: 5, y_pct: 3, w_pct: 90, h_pct: 8 },
        "heading",
      ),
      placeholderImagePanel({ x_pct: 5, y_pct: 14, w_pct: 90, h_pct: 40 }),
      placeholderImagePanel({ x_pct: 5, y_pct: 56, w_pct: 90, h_pct: 40 }),
    ]),

    // Page 4 — Hardscape Details
    makePage(3, "Hardscape Details", [
      textPanel(
        "Hardscape Specification",
        "",
        { x_pct: 5, y_pct: 3, w_pct: 90, h_pct: 8 },
        "heading",
      ),
      widgetPanel("zone_summary", { x_pct: 5, y_pct: 14, w_pct: 45, h_pct: 55 }),
      swatchPanel(
        materials.map((m) => m.id),
        "Material schedule",
        { x_pct: 53, y_pct: 14, w_pct: 42, h_pct: 55 },
      ),
    ]),

    // Page 5 — Plant Schedule
    makePage(4, "Plant Schedule", [
      textPanel(
        "Plant Schedule",
        "",
        { x_pct: 5, y_pct: 3, w_pct: 90, h_pct: 8 },
        "heading",
      ),
      textPanel(
        plantSchedule && plantSchedule.length > 0
          ? plantSchedule
              .map(
                (p) =>
                  `${p.commonName} (${p.botanical}) — ${p.size}, qty ${p.qty}, ${p.spacing} centres, ${p.rootBall} root ball`,
              )
              .join("\n")
          : "Plant schedule will be generated from placed assets.",
        "",
        { x_pct: 5, y_pct: 14, w_pct: 90, h_pct: 75 },
        "body",
      ),
    ]),

    // Page 6 — Irrigation Plan
    makePage(5, "Irrigation Plan", [
      textPanel(
        "Irrigation Layout",
        "Zone layout, pipe runs, and head positions.",
        { x_pct: 5, y_pct: 3, w_pct: 90, h_pct: 8 },
        "heading",
      ),
      planCropPanel("feature", "Irrigation zones", { x_pct: 5, y_pct: 14, w_pct: 90, h_pct: 78 }, revision),
    ]),

    // Page 7 — Lighting Plan
    makePage(6, "Lighting Plan", [
      textPanel(
        "Lighting Layout",
        "Fixture positions, cable runs, and DB schedule.",
        { x_pct: 5, y_pct: 3, w_pct: 90, h_pct: 8 },
        "heading",
      ),
      planCropPanel("feature", "Lighting layout", { x_pct: 5, y_pct: 14, w_pct: 90, h_pct: 78 }, revision),
    ]),

    // Page 8 — Drainage Plan
    makePage(7, "Drainage Plan", [
      textPanel(
        "Drainage & Stormwater",
        "Trench paths, ag-pipe corridors, and legal point of discharge.",
        { x_pct: 5, y_pct: 3, w_pct: 90, h_pct: 8 },
        "heading",
      ),
      planCropPanel("feature", "Drainage layout", { x_pct: 5, y_pct: 14, w_pct: 90, h_pct: 78 }, revision),
    ]),

    // Page 9 — Earthworks
    makePage(8, "Earthworks", [
      textPanel(
        "Earthworks & Cut/Fill",
        "Proposed levels, cut/fill volumes, and compaction requirements.",
        { x_pct: 5, y_pct: 3, w_pct: 90, h_pct: 8 },
        "heading",
      ),
      textPanel(
        `Site slope: ${site.slopeDegrees}° south\nProposed levels derived from Vicmap contours.\nDetailed levels to be confirmed by surveyor on site.`,
        "",
        { x_pct: 5, y_pct: 14, w_pct: 90, h_pct: 30 },
        "body",
      ),
      planCropPanel("elevation", "Terrain mesh", { x_pct: 5, y_pct: 48, w_pct: 90, h_pct: 48 }, revision),
    ]),

    // Page 10 — Material Quantities
    makePage(9, "Material Quantities", [
      textPanel(
        "Material Quantities",
        "",
        { x_pct: 5, y_pct: 3, w_pct: 90, h_pct: 8 },
        "heading",
      ),
      widgetPanel("quote_total", { x_pct: 5, y_pct: 14, w_pct: 45, h_pct: 55 }),
      textPanel(
        estimate
          ? [
              `Hardscape: ${estimate.hardscapeM2} m²`,
              `Excavation: ${estimate.excavateM3} m³`,
              "",
              ...estimate.lines.map(
                (l) => `${l.label}: ${l.qty} ${l.unit} = $${l.total.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              ),
              "",
              `Subtotal (ex GST): $${estimate.materialsExGst.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`,
              `GST (10%): $${estimate.gst.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`,
              `TOTAL (incl GST): $${estimate.totalInclGst.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`,
            ].join("\n")
          : "Quantities will be populated once the design is costed.",
        "",
        { x_pct: 53, y_pct: 14, w_pct: 42, h_pct: 55 },
        "body",
      ),
    ]),

    // Page 11 — Compliance
    makePage(10, "Compliance & Notes", [
      textPanel(
        "Compliance & Regulatory Notes",
        "",
        { x_pct: 5, y_pct: 3, w_pct: 90, h_pct: 8 },
        "heading",
      ),
      textPanel(
        [
          `All works comply with the relevant planning scheme overlays for ${site.lga}`,
          "Tree removal requires a permit — see arborist report",
          "Retaining walls >600mm require engineering certification",
          "Stormwater must connect to legal point of discharge (BYDA required)",
          "Underground services located via Dial Before You Dig",
          "",
          "Title easements from Vicmap — digging still needs BYDA",
          "Indicative levels derived from Vicmap contours",
        ].join("\n"),
        "",
        { x_pct: 5, y_pct: 14, w_pct: 90, h_pct: 70 },
        "body",
      ),
    ]),

    // Page 12 — Tender Summary
    makePage(11, "Tender Summary", [
      textPanel(
        "Tender Summary",
        "",
        { x_pct: 8, y_pct: 5, w_pct: 84, h_pct: 10 },
        "heading",
      ),
      widgetPanel("quote_total", { x_pct: 8, y_pct: 18, w_pct: 84, h_pct: 50 }),
      textPanel(
        "Indicative — confirm before tender. All prices exclude GST unless stated. Variations may apply based on site conditions confirmed during construction.",
        "",
        { x_pct: 8, y_pct: 72, w_pct: 84, h_pct: 10 },
        "caption",
      ),
      widgetPanel("honesty_footer", { x_pct: 8, y_pct: 85, w_pct: 84, h_pct: 10 }),
    ]),
  ];
}
