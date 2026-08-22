import { describe, expect, it } from "vitest";
import {
  CANVAS_REDIRECT_SECTIONS,
  PROJECT_SURFACES,
  canvasHref,
  processingHref,
  projectSectionFromPathname,
} from "./project-sections";

describe("projectSectionFromPathname", () => {
  it("returns null for the canvas itself — the drawing is not a section", () => {
    expect(projectSectionFromPathname("/projects/abc")).toBeNull();
  });

  it("returns null off the project tree", () => {
    expect(projectSectionFromPathname("/home")).toBeNull();
    expect(projectSectionFromPathname("/settings/license")).toBeNull();
    expect(projectSectionFromPathname("/growth-studio/abc")).toBeNull();
  });

  it("reads the project id and section from a record route", () => {
    expect(projectSectionFromPathname("/projects/abc/audit")).toEqual({
      projectId: "abc",
      section: "audit",
      label: "Audit",
      isCanvasRedirect: false,
    });
  });

  it("keeps nested legacy sections intact and flags them as redirects", () => {
    const section = projectSectionFromPathname("/projects/abc/design/cad");
    expect(section?.section).toBe("design/cad");
    expect(section?.isCanvasRedirect).toBe(true);
  });

  it("falls back to the raw section when no label is registered", () => {
    expect(projectSectionFromPathname("/projects/abc/unknown")?.label).toBe(
      "unknown",
    );
  });
});

describe("project surfaces", () => {
  it("gives every surface a unique id, a label and a hint", () => {
    const ids = PROJECT_SURFACES.map((surface) => surface.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const surface of PROJECT_SURFACES) {
      expect(surface.label.length).toBeGreaterThan(0);
      expect(surface.hint.length).toBeGreaterThan(0);
    }
  });

  it("carries the two 3D studios that shipped without an entry point", () => {
    expect(
      PROJECT_SURFACES.find((s) => s.id === "growth-studio")?.href("abc"),
    ).toBe("/growth-studio/abc");
    expect(
      PROJECT_SURFACES.find((s) => s.id === "subsurface-studio")?.href("abc"),
    ).toBe("/subsurface-studio/abc");
  });

  it("points every record surface at its own project sub-route", () => {
    for (const surface of PROJECT_SURFACES.filter((s) => s.group === "records")) {
      expect(surface.href("abc")).toBe(`/projects/abc/${surface.id}`);
    }
  });

  /* A surface that is also a redirect alias would bounce the operator straight
   * back to the canvas — the rail would look broken rather than be broken. */
  it("never offers a section that only redirects onto the canvas", () => {
    for (const surface of PROJECT_SURFACES) {
      expect(CANVAS_REDIRECT_SECTIONS.has(surface.id)).toBe(false);
    }
  });

  it("marks the active surface by matching the pathname section", () => {
    const section = projectSectionFromPathname("/projects/abc/measurements");
    const active = PROJECT_SURFACES.filter((s) => s.id === section?.section);
    expect(active.map((s) => s.label)).toEqual(["Measurements"]);
  });
});

describe("href builders", () => {
  it("builds the pipeline progress href", () => {
    expect(processingHref("abc")).toBe("/projects/abc/processing");
  });

  it("builds canvas hrefs with and without a mode", () => {
    expect(canvasHref("abc")).toBe("/projects/abc");
    expect(canvasHref("abc", "cad")).toBe("/projects/abc?mode=cad");
  });
});
