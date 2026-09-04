import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { LayersPanel } from "./LayersPanel";

describe("<LayersPanel>", () => {
  it("renders the planes and analysis sections from the store", () => {
    const html = renderToStaticMarkup(
      createElement(LayersPanel, { overlays: [] }),
    );
    expect(html).toContain("Layers");
    expect(html).toContain("Planes");
    expect(html).toContain("Ground");
    expect(html).toContain("DRAWING");
    expect(html).toContain("Survey base");
    expect(html).toContain("IMPORTED");
    expect(html).toContain("Planting");
    expect(html).toContain("Massing");
    expect(html).toContain("Analysis");
    expect(html).toContain("Suncast");
    expect(html).toContain("Earthworks");
  });

  /**
   * Planting and Massing became `drawable` when Tidy gained Z-plane routing,
   * which moved them out of the read-only reference row and into a selectable
   * one. Survey is the only fixed plane left that cannot take geometry, so
   * `IMPORTED` is now the only tag rendered and `PROPOSED` is gone — asserted
   * here so a future re-lock of a plane has to come back through this test.
   */
  it("renders every drawable plane as a selectable DRAWING row", () => {
    const html = renderToStaticMarkup(
      createElement(LayersPanel, { overlays: [] }),
    );
    // Ground, Planting and Massing — three drawable planes, three badges.
    expect(html.match(/DRAWING/g)).toHaveLength(3);
    // Survey alone is reference chrome.
    expect(html.match(/IMPORTED/g)).toHaveLength(1);
    expect(html).not.toContain("PROPOSED");
  });

  /**
   * The regression this guards: all three drawable rows were wired to
   * `activeCanvasId === null`, so they reported active simultaneously and
   * every click selected the ground. Fixed planes select through
   * `activePlaneId`, so exactly one row can be active at a time.
   */
  it("marks exactly one plane active", () => {
    const html = renderToStaticMarkup(
      createElement(LayersPanel, { overlays: [] }),
    );
    // Scoped to plane rows: the analysis toggles below also use aria-pressed.
    const pressed = html.match(/aria-pressed="true" data-plane-row="[^"]+"/g) ?? [];
    const unpressed = html.match(/aria-pressed="false" data-plane-row="[^"]+"/g) ?? [];
    expect(pressed).toHaveLength(1);
    // The other two drawable rows are present and unpressed, not absent.
    expect(unpressed).toHaveLength(2);
    // `activePlaneId` defaults to ground, so that is the one that reads active.
    expect(pressed[0]).toContain('data-plane-row="Ground"');
  });
});
