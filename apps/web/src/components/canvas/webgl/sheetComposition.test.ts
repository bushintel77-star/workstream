import { describe, expect, it } from "vitest";
import {
  PAPER_DIMENSIONS_MM,
  buildLegendFromMaterials,
  buildTitleBlock,
  createSheet,
  computeViewportCrop,
  computeImpliedScale,
  issueSheet,
  issueDate,
  revisionLetter,
  formatScale,
  ALL_MATERIAL_IDS,
} from "./sheetComposition";

describe("sheetComposition — Phase Q", () => {
  describe("Q.3 — legend auto-builds from materials used", () => {
    it("builds legend from a subset of materials", () => {
      const legend = buildLegendFromMaterials(["setback", "gas", "moss"]);
      expect(legend).toHaveLength(3);
      expect(legend[0].label).toBe("Setback");
      expect(legend[0].semantic).toBe(true);
      expect(legend[0].dash).toEqual([26, 10]);
      expect(legend[1].label).toBe("Gas");
      expect(legend[2].label).toBe("Moss");
      expect(legend[2].semantic).toBe(false);
    });

    it("deduplicates material ids", () => {
      const legend = buildLegendFromMaterials(["setback", "setback", "gas"]);
      expect(legend).toHaveLength(2);
    });

    it("skips unknown material ids", () => {
      const legend = buildLegendFromMaterials(["setback", "unknown-id"]);
      expect(legend).toHaveLength(1);
    });

    it("all 21 materials produce 21 legend entries", () => {
      const legend = buildLegendFromMaterials(ALL_MATERIAL_IDS);
      expect(legend).toHaveLength(21);
    });
  });

  describe("Q.4 — title block", () => {
    it("builds a title block with all fields", () => {
      const tb = buildTitleBlock({
        project: "36 Wrights Terrace",
        sheet: "L-01",
        scale: 200,
        northBearingDeg: 45,
        templateVersion: "v1",
      });
      expect(tb.project).toBe("36 Wrights Terrace");
      expect(tb.sheet).toBe("L-01");
      expect(tb.scale).toBe("1:200");
      expect(tb.north).toBe("45\u00B0");
      expect(tb.templateVersion).toBe("v1");
    });

    it("defaults north to N↑ when bearing is null", () => {
      const tb = buildTitleBlock({
        project: "test",
        sheet: "L-01",
        scale: 200,
        templateVersion: "v1",
      });
      expect(tb.north).toBe("N\u2191");
    });
  });

  describe("Q.1 — createSheet", () => {
    it("creates a sheet with defaults", () => {
      const sheet = createSheet({
        number: "L-01",
        title: "Site plan",
        project: "Test project",
      });
      expect(sheet.number).toBe("L-01");
      expect(sheet.title).toBe("Site plan");
      expect(sheet.paperSize).toBe("A1");
      expect(sheet.orientation).toBe("landscape");
      expect(sheet.viewports).toEqual([]);
      expect(sheet.issued).toBe(false);
      expect(sheet.revision).toBe(0);
    });

    it("creates a sheet with custom paper size", () => {
      const sheet = createSheet({
        number: "L-02",
        title: "Planting plan",
        project: "Test",
        paperSize: "A0",
        orientation: "portrait",
      });
      expect(sheet.paperSize).toBe("A0");
      expect(sheet.orientation).toBe("portrait");
    });
  });

  describe("Q.10 — crop, never rescale", () => {
    it("computes the crop area for a viewport", () => {
      const crop = computeViewportCrop(
        { w: 594, h: 420, scale: 200 },
        { w: 50, h: 50 },
      );
      // Visible: 594/1000*200 = 118.8m wide, 420/1000*200 = 84m tall
      // Canvas is 50x50m, so crop is capped at canvas size
      expect(crop.cropW).toBeLessThanOrEqual(50);
      expect(crop.cropH).toBeLessThanOrEqual(50);
    });

    it("crop is centered on the canvas", () => {
      const crop = computeViewportCrop(
        { w: 297, h: 210, scale: 200 },
        { w: 100, h: 100 },
      );
      // Visible: 59.4m x 42m — fits within 100x100 canvas
      expect(crop.cropW).toBeCloseTo(59.4, 1);
      expect(crop.cropH).toBeCloseTo(42, 1);
      expect(crop.cropX).toBeCloseTo(20.3, 1); // (100 - 59.4) / 2
    });
  });

  describe("Q.11 — implied scale from frame", () => {
    it("computes the scale that would fit the canvas", () => {
      const scale = computeImpliedScale(
        { w: 594, h: 420 },
        { w: 100, h: 100 },
      );
      // max(100*1000/594, 100*1000/420) = max(168.4, 238.1) = 238.1 → ceil to 240
      expect(scale).toBe(240);
    });

    it("never applies the scale — only states it", () => {
      // This is a pure function; it does not mutate any viewport.
      const scale = computeImpliedScale({ w: 297, h: 210 }, { w: 50, h: 50 });
      expect(scale).toBeGreaterThan(0);
    });
  });

  describe("Q.12 — issue freezes viewports", () => {
    it("issueSheet freezes all live viewports", () => {
      const sheet = createSheet({
        number: "L-01",
        title: "Site plan",
        project: "Test",
      });
      sheet.viewports = [
        { id: "v1", cameraPreset: "plan", scale: 200, x: 0, y: 0, w: 594, h: 420, live: true, issued: false },
        { id: "v2", cameraPreset: "axo", scale: 200, x: 0, y: 0, w: 297, h: 210, live: true, issued: false },
      ];
      const issued = issueSheet(sheet);
      expect(issued.issued).toBe(true);
      expect(issued.revision).toBe(1);
      expect(issued.viewports.every((v) => !v.live)).toBe(true);
      expect(issued.viewports.every((v) => v.issued)).toBe(true);
      expect(issued.issuedAt).toBeDefined();
    });
  });

  describe("paper dimensions", () => {
    it("A0 is the largest", () => {
      expect(PAPER_DIMENSIONS_MM.A0.w).toBeGreaterThan(PAPER_DIMENSIONS_MM.A1.w);
    });
    it("A3 is the smallest", () => {
      expect(PAPER_DIMENSIONS_MM.A3.w).toBeLessThan(PAPER_DIMENSIONS_MM.A2.w);
    });
  });

  describe("formatScale", () => {
    it("formats scale as 1:N", () => {
      expect(formatScale(200)).toBe("1:200");
      expect(formatScale(1)).toBe("1:1");
    });
  });

  describe("revision letters", () => {
    it("counts from A", () => {
      expect(revisionLetter(0)).toBe("A");
      expect(revisionLetter(1)).toBe("B");
      expect(revisionLetter(25)).toBe("Z");
    });

    it("rolls over past Z", () => {
      expect(revisionLetter(26)).toBe("AA");
      expect(revisionLetter(27)).toBe("AB");
    });
  });

  describe("issue date is local, not UTC", () => {
    it("uses the local calendar day", () => {
      // 09:00 on 4 Sep in a UTC+10 zone is 23:00 on 3 Sep UTC. The title
      // block must read the day the operator is living in.
      const local = new Date(2026, 8, 4, 9, 0, 0);
      expect(issueDate(local)).toBe("2026-09-04");
      expect(issueDate(local)).not.toBe(local.toISOString().slice(0, 10));
    });

    it("pads single-digit months and days", () => {
      expect(issueDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    });
  });

  describe("issueSheet carries the revision onto paper", () => {
    const sheet = () =>
      createSheet({ number: "L-01", title: "Site plan", project: "1 Test St" });

    it("starts at Rev A", () => {
      expect(sheet().titleBlock.rev).toBe("A");
      expect(sheet().revision).toBe(0);
    });

    it("bumps the title block rev, not just the counter", () => {
      let s = sheet();
      s = issueSheet(s);
      expect(s.revision).toBe(1);
      expect(s.titleBlock.rev).toBe("B");
      s = issueSheet(s);
      expect(s.revision).toBe(2);
      expect(s.titleBlock.rev).toBe("C");
    });

    it("restamps the issue date", () => {
      const s = issueSheet(sheet(), new Date(2027, 2, 9, 14, 0, 0));
      expect(s.titleBlock.date).toBe("2027-03-09");
    });

    it("never leaves the title block behind the counter", () => {
      let s = sheet();
      for (let i = 0; i < 5; i++) s = issueSheet(s);
      expect(s.titleBlock.rev).toBe(revisionLetter(s.revision));
    });
  });

  describe("sheet ids are unique", () => {
    it("does not collide within a millisecond", () => {
      const ids = new Set(
        Array.from({ length: 200 }, () =>
          createSheet({ number: "L-01", title: "t", project: "p" }).id,
        ),
      );
      expect(ids.size).toBe(200);
    });
  });
});
