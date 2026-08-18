/**
 * Boundary tests — every Zod schema must accept its canonical example
 * shape, and reject obvious malformed input. If a schema changes here and
 * isn't deliberate, the corresponding API route + UI need attention.
 */
import { describe, expect, it } from "vitest";
import {
  ActivityEventSchema,
  AuditSchema,
  CostingSchema,
  CreateOverrideInputSchema,
  CreatePresentationDocumentInputSchema,
  CreateProjectInputSchema,
  CreateTaskInputSchema,
  DesignSchema,
  OutputSchema,
  PhotoElevationSchema,
  PhotoMeasurementSchema,
  PlantPaletteSchema,
  PresentationDocumentSchema,
  ProjectSchema,
  RateCardSchema,
  RecordingSchema,
  SurveySchema,
  TaskSchema,
} from "../index";

const UUID = "00000000-0000-0000-0000-000000000000";
const ISO = "2026-05-18T00:00:00.000Z";

describe("CreateProjectInputSchema", () => {
  it("accepts a minimal address-only input", () => {
    expect(
      CreateProjectInputSchema.safeParse({ address: "1 Smith St" }).success,
    ).toBe(true);
  });
  it("rejects too-short addresses", () => {
    expect(
      CreateProjectInputSchema.safeParse({ address: "X" }).success,
    ).toBe(false);
  });
});

describe("ProjectSchema", () => {
  it("accepts a full project row", () => {
    const ok = ProjectSchema.safeParse({
      id: UUID,
      owner_id: "dev-user",
      address: "22 Smith St, Carlton VIC 3053",
      lat: -37.8,
      lng: 144.96,
      created_at: ISO,
      status: "draft",
      client_name: null,
      client_email: null,
      crm_stage: "enquiry",
      crm_synced_at: null,
    });
    expect(ok.success).toBe(true);
  });
  it("rejects an unknown status", () => {
    const bad = ProjectSchema.safeParse({
      id: UUID,
      owner_id: "u",
      address: "addr",
      lat: 0,
      lng: 0,
      created_at: ISO,
      status: "shipped",
    });
    expect(bad.success).toBe(false);
  });
});

describe("SurveySchema", () => {
  it("accepts a canonical survey", () => {
    const ok = SurveySchema.safeParse({
      id: UUID,
      project_id: UUID,
      aerial_uri: "https://example.com/aerial.jpg",
      title_polygon: {
        type: "Polygon",
        coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]],
      },
      house_polygon: {
        type: "Polygon",
        coordinates: [[[0, 0], [0, 0.5], [0.5, 0.5], [0, 0]]],
      },
      garden_polygon: {
        type: "Polygon",
        coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]],
      },
      lot_area_m2: 600,
      house_area_m2: 96,
      garden_area_m2: 504,
      measurements: [
        { edge_id: "front", length_m: 15, bearing_deg: 180 },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it("represents an unavailable existing-house outline without invented geometry", () => {
    const ok = SurveySchema.safeParse({
      id: UUID,
      project_id: UUID,
      aerial_uri: "https://example.com/aerial.jpg",
      title_polygon: {
        type: "Polygon",
        coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]],
      },
      house_polygon: { type: "Polygon", coordinates: [] },
      garden_polygon: {
        type: "Polygon",
        coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]],
      },
      lot_area_m2: 600,
      house_area_m2: 0,
      garden_area_m2: 600,
      measurements: [],
    });
    expect(ok.success).toBe(true);
  });

  it("allows zero lot/garden when Vicmap missed — aerial Trace is the redundancy", () => {
    const ok = SurveySchema.safeParse({
      id: UUID,
      project_id: UUID,
      aerial_uri: "https://example.com/aerial.jpg",
      title_polygon: { type: "Polygon", coordinates: [] },
      house_polygon: { type: "Polygon", coordinates: [] },
      garden_polygon: { type: "Polygon", coordinates: [] },
      lot_area_m2: 0,
      house_area_m2: 0,
      garden_area_m2: 0,
      measurements: [],
    });
    expect(ok.success).toBe(true);
  });

  it("leaves site_photos absent on pre-gallery surveys", () => {
    const ok = SurveySchema.safeParse({
      id: UUID,
      project_id: UUID,
      aerial_uri: "https://example.com/aerial.jpg",
      title_polygon: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
      house_polygon: { type: "Polygon", coordinates: [] },
      garden_polygon: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
      lot_area_m2: 600,
      house_area_m2: 0,
      garden_area_m2: 600,
      measurements: [],
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.site_photos).toBeUndefined();
  });

  it("carries the site-photo gallery through", () => {
    const ok = SurveySchema.safeParse({
      id: UUID,
      project_id: UUID,
      aerial_uri: "https://example.com/aerial.jpg",
      title_polygon: { type: "Polygon", coordinates: [] },
      house_polygon: { type: "Polygon", coordinates: [] },
      garden_polygon: { type: "Polygon", coordinates: [] },
      lot_area_m2: 0,
      house_area_m2: 0,
      garden_area_m2: 0,
      measurements: [],
      site_photos: [
        {
          id: UUID,
          name: "Rear fence",
          uri: "https://example.com/photos/rear.png",
          natural_aspect: 1.5,
          created_at: ISO,
        },
      ],
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.site_photos).toHaveLength(1);
  });
});

describe("PhotoElevationSchema", () => {
  const canonical = {
    id: UUID,
    photo_id: UUID,
    name: "Rear fence",
    uri: "https://example.com/photos/rear.jpg",
    natural_aspect: 1.5,
    azimuth_deg: 180,
    calibration: {
      plane_width_m: 12,
      reference_m: 1.8,
      label: "1.8 m fence line",
    },
    centre_x_m: 0,
    centre_z_m: -8,
    ground_offset_m: 0,
    strokes: [
      {
        id: UUID,
        points: [
          { x_m: -2, y_m: 0.2 },
          { x_m: 1.5, y_m: 0.9 },
        ],
        width_px: 2,
        color: "#0030CF",
      },
    ],
    created_at: ISO,
    updated_at: ISO,
  };

  it("accepts a calibrated photo elevation with a trace stroke", () => {
    const ok = PhotoElevationSchema.safeParse(canonical);
    expect(ok.success).toBe(true);
  });

  it("defaults uncalibrated with an empty stroke set", () => {
    const ok = PhotoElevationSchema.safeParse({
      id: UUID,
      photo_id: UUID,
      name: "Street frontage",
      uri: "https://example.com/photos/front.jpg",
      natural_aspect: 0.75,
      created_at: ISO,
      updated_at: ISO,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.calibration).toBeNull();
      expect(ok.data.strokes).toEqual([]);
      expect(ok.data.azimuth_deg).toBe(0);
      expect(ok.data.boundary_snap).toBeNull();
    }
  });

  it("records a title-boundary snap when the plane is reconciled", () => {
    const ok = PhotoElevationSchema.safeParse({
      ...canonical,
      boundary_snap: { edge_index: 3, snapped_at: ISO },
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.boundary_snap?.edge_index).toBe(3);
    }
  });

  it("rejects a negative calibration reference length", () => {
    const bad = PhotoElevationSchema.safeParse({
      ...canonical,
      calibration: {
        plane_width_m: 12,
        reference_m: -1,
        label: "bad",
      },
    });
    expect(bad.success).toBe(false);
  });
});

describe("DesignSchema", () => {
  it("accepts a minimal zone-only design", () => {
    const ok = DesignSchema.safeParse({
      id: UUID,
      project_id: UUID,
      mode: "auto",
      proposal: { zones: [], estimated_complexity: "standard" },
      gaps: [],
      rationale: "test",
      version: 1,
    });
    expect(ok.success).toBe(true);
  });
});

describe("CostingSchema", () => {
  it("accepts standard scenario with one line", () => {
    const ok = CostingSchema.safeParse({
      id: UUID,
      design_id: UUID,
      scenario: "standard",
      line_items: [
        {
          sku: "LAB-LABOUR-HR",
          label: "Labour",
          unit: "hr",
          qty: 10,
          rate: 95,
          total: 950,
          is_provisional: false,
        },
      ],
      subtotal: 950,
      gst: 95,
      total: 1045,
    });
    expect(ok.success).toBe(true);
  });
});

describe("AuditSchema", () => {
  it("accepts a passed audit with no findings", () => {
    expect(
      AuditSchema.safeParse({
        id: UUID,
        design_id: UUID,
        findings: [],
        blocking_count: 0,
        advisory_count: 0,
        passed: true,
      }).success,
    ).toBe(true);
  });
});

describe("CreateOverrideInputSchema", () => {
  it("requires a reason of at least 8 chars", () => {
    expect(
      CreateOverrideInputSchema.safeParse({
        finding_index: 0,
        reason: "ok",
      }).success,
    ).toBe(false);
    expect(
      CreateOverrideInputSchema.safeParse({
        finding_index: 0,
        reason: "design intentionally exceeds the budget cap because…",
      }).success,
    ).toBe(true);
  });
});

describe("OutputSchema", () => {
  it("accepts every output kind", () => {
    const kinds = [
      "task_list",
      "schedule",
      "quote",
      "brochure",
      "scope",
      "daily_site_report",
      "permit_stonnington_stormwater",
      "permit_yarra_heritage",
      "establishment_calendar",
      "handover_pack",
      "supplier_order",
    ];
    for (const kind of kinds) {
      const ok = OutputSchema.safeParse({
        id: UUID,
        project_id: UUID,
        kind,
        uri: "https://example.com/out",
        generated_at: ISO,
      });
      expect(ok.success).toBe(true);
    }
  });
});

describe("CreateTaskInputSchema", () => {
  it("defaults priority to medium", () => {
    const parsed = CreateTaskInputSchema.safeParse({ title: "Set out bed" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.priority).toBe("medium");
  });
});

describe("TaskSchema", () => {
  it("accepts every status", () => {
    for (const status of [
      "pending",
      "in_progress",
      "blocked",
      "done",
      "cancelled",
    ]) {
      const ok = TaskSchema.safeParse({
        id: UUID,
        project_id: UUID,
        title: "t",
        assignee_name: null,
        priority: "medium",
        technical_specifications: null,
        status,
        source: "manual",
        created_at: ISO,
      });
      expect(ok.success).toBe(true);
    }
  });
});

describe("RateCardSchema + PlantPaletteSchema + RecordingSchema + PhotoMeasurementSchema", () => {
  it("accept their canonical examples", () => {
    expect(
      RateCardSchema.safeParse({
        id: UUID,
        owner_id: "system",
        category: "labour",
        sku: "LAB-HR",
        label: "Labour, per hour",
        unit: "hr",
        rate: 95,
        effective_from: ISO,
      }).success,
    ).toBe(true);

    expect(
      PlantPaletteSchema.safeParse({
        id: UUID,
        owner_id: "system",
        species: "Lomandra longifolia",
        common_name: "Spiny-headed mat-rush",
        mature_h_m: 0.9,
        mature_w_m: 1.2,
        category: "tussock",
        use_description: "Mass planting",
        climate_zones: ["VIC"],
        curtis_approved: true,
      }).success,
    ).toBe(true);

    const recording = RecordingSchema.safeParse({
      id: UUID,
      project_id: UUID,
      audio_uri: "https://example.com/audio.webm",
      duration_s: 60,
      transcript: null,
      transcription_confidence: null,
    });
    expect(recording.success).toBe(true);
    if (recording.success) expect(recording.data.dil_consent).toBe(false);

    expect(
      RecordingSchema.safeParse({
        id: UUID,
        project_id: UUID,
        audio_uri: "https://example.com/audio.webm",
        duration_s: 60,
        transcript: null,
        transcription_confidence: null,
        dil_consent: false,
      }).success,
    ).toBe(true);

    expect(
      PhotoMeasurementSchema.safeParse({
        id: UUID,
        project_id: UUID,
        image_uri: "https://example.com/photo.jpg",
        items: [
          {
            description: "Wall height",
            value: 1.8,
            unit: "meters",
            confidence: 0.92,
            reference_used: "30cm ruler",
          },
        ],
        notes: null,
        created_at: ISO,
      }).success,
    ).toBe(true);
  });
});

describe("ActivityEventSchema", () => {
  it("accepts a project delete event", () => {
    expect(
      ActivityEventSchema.safeParse({
        id: UUID,
        owner_id: "dev-user",
        project_id: UUID,
        action: "project.deleted",
        subject_id: UUID,
        detail: 'Project "22 Smith St" moved to trash',
        created_at: ISO,
      }).success,
    ).toBe(true);
  });

  it("accepts a workspace crew delete event", () => {
    expect(
      ActivityEventSchema.safeParse({
        id: UUID,
        owner_id: "dev-user",
        project_id: null,
        action: "crew_member.deleted",
        subject_id: UUID,
        detail: 'Crew member "Alex Site" removed',
        created_at: ISO,
      }).success,
    ).toBe(true);
  });
});

describe("PresentationDocumentSchema", () => {
  it("accepts a minimal deck with one blank page", () => {
    const ok = PresentationDocumentSchema.safeParse({
      id: UUID,
      project_id: UUID,
      owner_id: "dev-user",
      title: "Wrights Terrace — concept deck",
      deliverable_type: "deck",
      template_id: "editorial_classic",
      theme: {
        palette: "stone",
        highlight_colour: "#b33a32",
        font: "fraunces",
        pen: "technical",
      },
      status: "draft",
      pages: [
        {
          id: UUID,
          order: 0,
          paper_size: "a3",
          orientation: "landscape",
          title_block: {
            title: "Wrights Terrace",
            subtitle: "Landscape concept plan",
            practice: "Curtis & Co",
            revision: "A",
            date_label: "",
            scale_label: "1:100 @ A3",
          },
          margins: { top_mm: 15, right_mm: 15, bottom_mm: 15, left_mm: 15 },
          panels: [],
        },
      ],
      created_at: ISO,
      updated_at: ISO,
    });
    expect(ok.success).toBe(true);
  });

  it("accepts a page with plan_crop, text, and widget panels", () => {
    const ok = PresentationDocumentSchema.safeParse({
      id: UUID,
      project_id: UUID,
      owner_id: "dev-user",
      pages: [
        {
          id: UUID,
          order: 0,
          panels: [
            {
              id: UUID,
              kind: "plan_crop",
              rect: { x_pct: 5, y_pct: 10, w_pct: 60, h_pct: 70 },
              z_index: 0,
              ref: {
                canvas_revision: 3,
                crop: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
                reason: "overview",
                label: "Site overview",
                synced: true,
              },
            },
            {
              id: UUID,
              kind: "text",
              rect: { x_pct: 70, y_pct: 5, w_pct: 25, h_pct: 20 },
              z_index: 1,
              heading: "Design narrative",
              body: "The north terrace becomes the hero...",
              role: "body",
            },
            {
              id: UUID,
              kind: "widget",
              rect: { x_pct: 70, y_pct: 30, w_pct: 25, h_pct: 15 },
              z_index: 2,
              widget: {
                id: UUID,
                type: "quote_total",
                slot: "side_stack",
                order: 0,
                style: { accent: "ink", emphasis: "hero" },
              },
            },
          ],
        },
      ],
      created_at: ISO,
      updated_at: ISO,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an unknown template_id", () => {
    const bad = PresentationDocumentSchema.safeParse({
      id: UUID,
      project_id: UUID,
      owner_id: "dev-user",
      template_id: "curtis-client-brochure",
      pages: [{ id: UUID, order: 0, panels: [] }],
      created_at: ISO,
      updated_at: ISO,
    });
    expect(bad.success).toBe(false);
  });

  it("rejects an invalid highlight colour", () => {
    const bad = PresentationDocumentSchema.safeParse({
      id: UUID,
      project_id: UUID,
      owner_id: "dev-user",
      theme: { highlight_colour: "red" },
      pages: [{ id: UUID, order: 0, panels: [] }],
      created_at: ISO,
      updated_at: ISO,
    });
    expect(bad.success).toBe(false);
  });

  it("rejects a document with no pages", () => {
    const bad = PresentationDocumentSchema.safeParse({
      id: UUID,
      project_id: UUID,
      owner_id: "dev-user",
      pages: [],
      created_at: ISO,
      updated_at: ISO,
    });
    expect(bad.success).toBe(false);
  });

  it("rejects an unknown panel kind", () => {
    const bad = PresentationDocumentSchema.safeParse({
      id: UUID,
      project_id: UUID,
      owner_id: "dev-user",
      pages: [
        {
          id: UUID,
          order: 0,
          panels: [
            {
              id: UUID,
              kind: "render",
              rect: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
              z_index: 0,
            },
          ],
        },
      ],
      created_at: ISO,
      updated_at: ISO,
    });
    expect(bad.success).toBe(false);
  });
});

describe("CreatePresentationDocumentInputSchema", () => {
  it("accepts an empty body (all fields optional)", () => {
    expect(CreatePresentationDocumentInputSchema.safeParse({}).success).toBe(
      true,
    );
  });

  it("accepts a deliverable type + template", () => {
    expect(
      CreatePresentationDocumentInputSchema.safeParse({
        deliverable_type: "quotation",
        template_id: "editorial_schedule",
      }).success,
    ).toBe(true);
  });
});
