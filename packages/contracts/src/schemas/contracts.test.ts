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
  CreateProjectInputSchema,
  CreateTaskInputSchema,
  DesignSchema,
  OutputSchema,
  PhotoMeasurementSchema,
  PlantPaletteSchema,
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

    expect(
      RecordingSchema.safeParse({
        id: UUID,
        project_id: UUID,
        audio_uri: "https://example.com/audio.webm",
        duration_s: 60,
        transcript: null,
        transcription_confidence: null,
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
