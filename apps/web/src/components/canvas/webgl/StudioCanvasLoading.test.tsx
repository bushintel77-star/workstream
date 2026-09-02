import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { StudioCanvasLoading } from "./StudioCanvasLoading";

describe("<StudioCanvasLoading> canvas loading surface", () => {
  it("renders a single announced status live region with the label", () => {
    const html = renderToStaticMarkup(
      createElement(StudioCanvasLoading, { label: "Importing site truth" }),
    );
    expect(html).toContain('data-testid="studio-canvas-loading"');
    // Exactly the announced contract: one role=status, polite live region.
    expect((html.match(/role="status"/g) ?? []).length).toBe(1);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Importing site truth");
  });

  it("shows the detail line when supplied and keeps the ring decorative", () => {
    const html = renderToStaticMarkup(
      createElement(StudioCanvasLoading, {
        label: "Importing site truth",
        detail: "14 Gisborne St",
        testId: "studio-canvas-loading-import",
      }),
    );
    expect(html).toContain('data-testid="studio-canvas-loading-import"');
    expect(html).toContain("14 Gisborne St");
    // The ring is decorative — never announced.
    expect(html).toContain("aria-hidden");
  });

  it("with stages: bounded ladder — progressbar, current stage, no infinite ring", () => {
    const html = renderToStaticMarkup(
      createElement(StudioCanvasLoading, {
        label: "Importing site truth",
        stages: [
          "Reading cadastre",
          "Tracing title boundary",
          "Placing easements and levels",
        ],
      }),
    );
    // The stage ladder replaces the indeterminate ring: a bounded progressbar.
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-valuenow="33"');
    // The first real stage is present and announced via the status label.
    expect(html).toContain("Reading cadastre");
    expect(html).toContain('aria-label="Reading cadastre"');
    expect((html.match(/role="status"/g) ?? []).length).toBe(1);
  });
});
