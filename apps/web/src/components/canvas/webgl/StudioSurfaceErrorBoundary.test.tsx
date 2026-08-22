import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudioSurfaceErrorBoundary } from "./StudioSurfaceErrorBoundary";

function renderBoundaryFallback(
  props: ConstructorParameters<typeof StudioSurfaceErrorBoundary>[0],
): string {
  const boundary = new StudioSurfaceErrorBoundary(props);
  boundary.state = {
    ...boundary.state,
    ...StudioSurfaceErrorBoundary.getDerivedStateFromError(new Error("boom")),
  };
  return renderToStaticMarkup(
    createElement("div", null, boundary.render()),
  );
}

describe("StudioSurfaceErrorBoundary", () => {
  it("transitions to failed state when a render error is reported", () => {
    expect(
      StudioSurfaceErrorBoundary.getDerivedStateFromError(new Error("boom")),
    ).toEqual({ failed: true });
  });

  it("renders the canvas fallback copy", () => {
    const html = renderBoundaryFallback({
      areaLabel: "Canvas surface",
      tone: "canvas",
      title: "Unable to render canvas view",
      detail: "The WebGL drawing surface hit a render exception.",
      children: createElement("div", null, "ok"),
    });
    expect(html).toContain("Unable to render canvas view");
    expect(html).toContain("role=\"alert\"");
    expect(html).toContain("Retry surface");
  });

  it("renders the design-assist fallback copy", () => {
    const html = renderBoundaryFallback({
      areaLabel: "Design assist panel",
      title: "Design assist unavailable",
      detail: "The AI drafter panel crashed and was isolated.",
      children: createElement("div", null, "ok"),
    });
    expect(html).toContain("Design assist unavailable");
    expect(html).toContain("AI drafter panel crashed");
  });
});
