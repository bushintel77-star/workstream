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
    expect(html).toContain("PROPOSED");
    expect(html).toContain("Analysis");
    expect(html).toContain("Suncast");
    expect(html).toContain("Earthworks");
  });
});
