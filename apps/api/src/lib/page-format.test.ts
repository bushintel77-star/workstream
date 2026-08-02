import { describe, expect, it } from "vitest";
import type { PresentationFormatRequest } from "@workstream/contracts";
import { formatPageLayout } from "./page-format";

const UUID = "00000000-0000-0000-0000-000000000001";

function makePanel(
  id: string,
  kind: PresentationFormatRequest["panels"][number]["kind"],
  extra: Partial<PresentationFormatRequest["panels"][number]> = {},
): PresentationFormatRequest["panels"][number] {
  return { id, kind, ...extra };
}

describe("formatPageLayout", () => {
  it("returns empty ghosts for no panels", () => {
    const result = formatPageLayout({
      deliverable_type: "deck",
      template_id: "editorial_classic",
      panels: [],
    });
    expect(result.ghosts).toEqual([]);
    expect(result.source).toBe("heuristic");
  });

  it("places a plan overview into the hero slot for a deck", () => {
    const result = formatPageLayout({
      deliverable_type: "deck",
      template_id: "editorial_classic",
      panels: [
        makePanel(UUID, "plan_crop", { reason: "overview" }),
      ],
    });
    expect(result.ghosts).toHaveLength(1);
    const hero = result.ghosts[0]!;
    expect(hero.rect.w_pct).toBeGreaterThan(40);
    expect(hero.rect.h_pct).toBeGreaterThan(40);
    expect(hero.rationale).toContain("hero");
  });

  it("places a quote_total widget into the schedule slot for a quotation", () => {
    const result = formatPageLayout({
      deliverable_type: "quotation",
      template_id: "editorial_schedule",
      panels: [
        makePanel(UUID, "widget", { widget_type: "quote_total" }),
      ],
    });
    expect(result.ghosts).toHaveLength(1);
    const schedule = result.ghosts[0]!;
    expect(schedule.rationale).toContain("schedule");
  });

  it("places a heading text panel into the blurb slot", () => {
    const result = formatPageLayout({
      deliverable_type: "deck",
      template_id: "editorial_classic",
      panels: [
        makePanel(UUID, "text", { role: "heading" }),
      ],
    });
    expect(result.ghosts).toHaveLength(1);
    expect(result.ghosts[0]!.rationale).toContain("blurb");
  });

  it("places a caption text panel into the caption slot", () => {
    const result = formatPageLayout({
      deliverable_type: "concept_sketch",
      template_id: "editorial_minimal",
      panels: [
        makePanel(UUID, "text", { role: "caption" }),
      ],
    });
    expect(result.ghosts).toHaveLength(1);
    expect(result.ghosts[0]!.rationale).toContain("caption");
  });

  it("assigns feature plan crops to drawing slots", () => {
    const result = formatPageLayout({
      deliverable_type: "deck",
      template_id: "editorial_classic",
      panels: [
        makePanel(`${UUID}1`, "plan_crop", { reason: "overview" }),
        makePanel(`${UUID}2`, "plan_crop", { reason: "feature" }),
        makePanel(`${UUID}3`, "plan_crop", { reason: "feature" }),
      ],
    });
    expect(result.ghosts).toHaveLength(3);
    const roles = result.ghosts.map((g) => g.rationale);
    expect(roles.some((r) => r.includes("hero"))).toBe(true);
    expect(roles.filter((r) => r.includes("drawing")).length).toBeGreaterThanOrEqual(2);
  });

  it("handles more panels than slots with overflow grid", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      makePanel(`${UUID}${i}`, "plan_crop", { reason: "feature" }),
    );
    const result = formatPageLayout({
      deliverable_type: "deck",
      template_id: "editorial_minimal",
      panels: many,
    });
    expect(result.ghosts).toHaveLength(10);
    const overflow = result.ghosts.filter((g) =>
      g.rationale.includes("overflow"),
    );
    expect(overflow.length).toBeGreaterThan(0);
  });

  it("editorial_feature template places hero on the left", () => {
    const result = formatPageLayout({
      deliverable_type: "deck",
      template_id: "editorial_feature",
      panels: [
        makePanel(UUID, "plan_crop", { reason: "overview" }),
      ],
    });
    expect(result.ghosts).toHaveLength(1);
    const hero = result.ghosts[0]!;
    expect(hero.rect.x_pct).toBeLessThan(50);
    expect(hero.rect.w_pct).toBeGreaterThan(40);
  });

  it("editorial_schedule template places schedule at top for quotations", () => {
    const result = formatPageLayout({
      deliverable_type: "quotation",
      template_id: "editorial_schedule",
      panels: [
        makePanel(`${UUID}1`, "widget", { widget_type: "quote_total" }),
        makePanel(`${UUID}2`, "text", { role: "heading" }),
      ],
    });
    expect(result.ghosts).toHaveLength(2);
    const schedule = result.ghosts.find((g) =>
      g.rationale.includes("schedule"),
    );
    const blurb = result.ghosts.find((g) => g.rationale.includes("blurb"));
    expect(schedule).toBeDefined();
    expect(blurb).toBeDefined();
    expect(schedule!.rect.y_pct).toBeLessThan(blurb!.rect.y_pct + 20);
  });

  it("mood_board prioritises drawing slots", () => {
    const result = formatPageLayout({
      deliverable_type: "mood_board",
      template_id: "editorial_classic",
      panels: [
        makePanel(`${UUID}1`, "image"),
        makePanel(`${UUID}2`, "image"),
        makePanel(`${UUID}3`, "image"),
      ],
    });
    expect(result.ghosts).toHaveLength(3);
    const drawingCount = result.ghosts.filter((g) =>
      g.rationale.includes("drawing"),
    ).length;
    expect(drawingCount).toBeGreaterThanOrEqual(2);
  });

  it("returns a rationale string", () => {
    const result = formatPageLayout({
      deliverable_type: "deck",
      template_id: "editorial_classic",
      panels: [makePanel(UUID, "text", { role: "heading" })],
    });
    expect(result.rationale).toContain("editorial_classic");
    expect(result.rationale).toContain("deck");
  });
});
