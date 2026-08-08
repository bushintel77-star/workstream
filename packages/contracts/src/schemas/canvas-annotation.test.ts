import { describe, expect, it } from "vitest";
import { CanvasAnnotationSchema } from "../index";

const UUID = "00000000-0000-0000-0000-000000000001";
const ISO = "2026-07-23T02:00:00.000Z";

describe("CanvasAnnotationSchema", () => {
  it("round-trips an item-anchored note", () => {
    const ok = CanvasAnnotationSchema.safeParse({
      id: UUID,
      text: "Retain existing lemon-scented gum",
      anchor: { kind: "item", itemId: "e1" },
      notePos: { x: 12, y: 18 },
      createdAt: ISO,
    });
    expect(ok.success).toBe(true);
  });

  it("round-trips a point-anchored note", () => {
    const ok = CanvasAnnotationSchema.safeParse({
      id: UUID,
      text: "New entry gate",
      anchor: { kind: "point", x: 42.5, y: 61 },
      notePos: { x: 8, y: 70 },
      createdAt: ISO,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects empty text and overlong notes", () => {
    expect(
      CanvasAnnotationSchema.safeParse({
        id: UUID,
        text: " ",
        anchor: { kind: "point", x: 1, y: 1 },
        notePos: { x: 2, y: 2 },
        createdAt: ISO,
      }).success,
    ).toBe(false);
    expect(
      CanvasAnnotationSchema.safeParse({
        id: UUID,
        text: "x".repeat(141),
        anchor: { kind: "point", x: 1, y: 1 },
        notePos: { x: 2, y: 2 },
        createdAt: ISO,
      }).success,
    ).toBe(false);
  });

  it("rejects the legacy kind/x_pct shape", () => {
    expect(
      CanvasAnnotationSchema.safeParse({
        id: UUID,
        kind: "text",
        x_pct: 10,
        y_pct: 20,
        text: "Old",
      }).success,
    ).toBe(false);
  });
});
