import { describe, it, expect } from "vitest";
import { assemblePdf } from "./pdfExport";
import {
  createSheet,
  type SheetViewport,
} from "./sheetComposition";

describe("pdfExport", () => {
  describe("assemblePdf", () => {
    it("produces a valid jsPDF document for an empty sheet", () => {
      const sheet = createSheet({
        number: "L-01",
        title: "Site plan",
        project: "20 Jean Street, South Yarra VIC 3141",
      });
      const doc = assemblePdf(sheet, new Map());
      // jsPDF exposes internal page count and dimensions
      expect(doc).toBeDefined();
      expect(doc.getNumberOfPages()).toBe(1);
    });

    it("produces an A1 landscape page at 841x594mm", () => {
      const sheet = createSheet({
        number: "L-01",
        title: "Site plan",
        project: "Test site",
        paperSize: "A1",
        orientation: "landscape",
      });
      const doc = assemblePdf(sheet, new Map());
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      // A1 landscape: 841mm x 594mm (±0.5mm for rounding)
      expect(Math.round(pageW)).toBe(841);
      expect(Math.round(pageH)).toBe(594);
    });

    it("produces an A3 portrait page at 297x420mm", () => {
      const sheet = createSheet({
        number: "L-02",
        title: "Detail",
        project: "Test site",
        paperSize: "A3",
        orientation: "portrait",
      });
      const doc = assemblePdf(sheet, new Map());
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      expect(Math.round(pageW)).toBe(297);
      expect(Math.round(pageH)).toBe(420);
    });

    it("does not throw when viewports have no captures (skips gracefully)", () => {
      const sheet = createSheet({
        number: "L-01",
        title: "Site plan",
        project: "Test site",
      });
      const vp: SheetViewport = {
        id: "vp-test",
        cameraPreset: "plan",
        scale: 200,
        x: 20,
        y: 20,
        w: 200,
        h: 150,
        live: true,
        issued: false,
        label: "Site plan",
      };
      sheet.viewports = [vp];
      // No captures in the map — assemblePdf should skip the viewport
      // without throwing
      expect(() => assemblePdf(sheet, new Map())).not.toThrow();
    });
  });
});
