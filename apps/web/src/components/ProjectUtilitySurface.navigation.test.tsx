import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SURFACE_PATH = path.join(HERE, "ProjectUtilitySurface.tsx");

describe("ProjectUtilitySurface navigation affordances", () => {
  it("renders direct links to studio and all records surfaces", () => {
    const src = readFileSync(SURFACE_PATH, "utf8");
    expect(src).toContain('aria-label="Project records navigation"');
    expect(src).toContain("Open design studio");
    expect(src).toContain("Pipeline progress");
    expect(src).toContain("/projects/${projectId}/outputs");
    expect(src).toContain("/projects/${projectId}/audit");
    expect(src).toContain("/projects/${projectId}/carbon");
    expect(src).toContain("/projects/${projectId}/measurements");
    expect(src).toContain("/projects/${projectId}/recordings");
  });

  it("shows explicit handoff readiness labels per output", () => {
    const src = readFileSync(SURFACE_PATH, "utf8");
    expect(src).toContain("Ready for handoff");
    expect(src).toContain("Not generated");
  });
});
