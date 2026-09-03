import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATE,
  createBinding,
  addOverride,
  revertOverride,
  diffForProject,
  applyAccepted,
  defaultAccepted,
  isClean,
  provenanceLine,
  type OfficeTemplate,
} from "./officeTemplate";

describe("officeTemplate — Phase R", () => {
  describe("R.1 — template holds conventions only", () => {
    it("DEFAULT_TEMPLATE has no geometry fields", () => {
      const keys = Object.keys(DEFAULT_TEMPLATE);
      expect(keys).not.toContain("geometry");
      expect(keys).not.toContain("site");
      expect(keys).not.toContain("boundary");
    });

    it("DEFAULT_TEMPLATE has 21 materials", () => {
      expect(DEFAULT_TEMPLATE.materials).toHaveLength(21);
    });

    it("DEFAULT_TEMPLATE has 4 planes", () => {
      expect(DEFAULT_TEMPLATE.planes).toHaveLength(4);
    });
  });

  describe("R.5 — binding is a reference", () => {
    it("createBinding creates a clean binding", () => {
      const b = createBinding("proj-1", DEFAULT_TEMPLATE);
      expect(b.projectId).toBe("proj-1");
      expect(b.templateId).toBe(DEFAULT_TEMPLATE.id);
      expect(b.boundVersion).toBe(DEFAULT_TEMPLATE.version);
      expect(b.overrides).toEqual([]);
      expect(isClean(b)).toBe(true);
    });
  });

  describe("R.6 — overrides never silent", () => {
    it("addOverride adds with reason", () => {
      const b = createBinding("proj-1", DEFAULT_TEMPLATE);
      const withOverride = addOverride(b, {
        path: "codes",
        from: DEFAULT_TEMPLATE.codes,
        to: { ...DEFAULT_TEMPLATE.codes, startAt: 10 },
        by: "Tim",
        at: "2026-01-15",
        reason: "Client requested starting at 10",
      });
      expect(withOverride.overrides).toHaveLength(1);
      expect(isClean(withOverride)).toBe(false);
    });

    it("null reason renders as 'no reason given'", () => {
      const b = createBinding("proj-1", DEFAULT_TEMPLATE);
      const withOverride = addOverride(b, {
        path: "codes",
        from: DEFAULT_TEMPLATE.codes,
        to: DEFAULT_TEMPLATE.codes,
        by: "Tim",
        at: "2026-01-15",
        reason: null,
      });
      expect(withOverride.overrides[0]!.reason).toBeNull();
      // The provenance line counts overrides, not reasons
      const line = provenanceLine(DEFAULT_TEMPLATE, withOverride);
      expect(line).toContain("1 override");
    });
  });

  describe("R.7 — override count in project chip, revert is one action", () => {
    it("revertOverride removes a single override by path", () => {
      const b = createBinding("proj-1", DEFAULT_TEMPLATE);
      const withOverride = addOverride(b, {
        path: "codes",
        from: DEFAULT_TEMPLATE.codes,
        to: DEFAULT_TEMPLATE.codes,
        by: "Tim",
        at: "2026-01-15",
        reason: "test",
      });
      const reverted = revertOverride(withOverride, "codes");
      expect(reverted.overrides).toHaveLength(0);
      expect(isClean(reverted)).toBe(true);
    });
  });

  describe("R.8 — new version is an offer with a diff", () => {
    it("diffForProject returns changes for differing keys", () => {
      const current = DEFAULT_TEMPLATE;
      const next: OfficeTemplate = {
        ...DEFAULT_TEMPLATE,
        version: 2,
        codes: { ...DEFAULT_TEMPLATE.codes, startAt: 10 },
      };
      const b = createBinding("proj-1", current);
      const diff = diffForProject(current, next, b);
      expect(diff.length).toBeGreaterThan(0);
      expect(diff.some((c) => c.path === "codes")).toBe(true);
    });

    it("diffForProject returns empty for identical templates", () => {
      const b = createBinding("proj-1", DEFAULT_TEMPLATE);
      const diff = diffForProject(DEFAULT_TEMPLATE, DEFAULT_TEMPLATE, b);
      expect(diff).toHaveLength(0);
    });

    it("codes change is destructive", () => {
      const current = DEFAULT_TEMPLATE;
      const next: OfficeTemplate = {
        ...DEFAULT_TEMPLATE,
        version: 2,
        codes: { ...DEFAULT_TEMPLATE.codes, startAt: 10 },
      };
      const b = createBinding("proj-1", current);
      const diff = diffForProject(current, next, b);
      const codesChange = diff.find((c) => c.path === "codes");
      expect(codesChange?.destructive).toBe(true);
    });

    it("defaultAccepted rejects destructive changes", () => {
      const change = {
        path: "codes" as const,
        label: "codes",
        affects: "",
        conflictsWithOverride: false,
        destructive: true,
      };
      expect(defaultAccepted(change)).toBe(false);
    });
  });

  describe("R.10 — issued sheets keep their version", () => {
    it("applyAccepted updates boundVersion only when changes are accepted", () => {
      const current = DEFAULT_TEMPLATE;
      const next: OfficeTemplate = {
        ...DEFAULT_TEMPLATE,
        version: 2,
        defaults: { ...DEFAULT_TEMPLATE.defaults, snapM: 1.0 },
      };
      const b = createBinding("proj-1", current);
      const diff = diffForProject(current, next, b);
      expect(diff.length).toBeGreaterThan(0);
      const applied = applyAccepted(b, next, diff);
      expect(applied.boundVersion).toBe(2);
    });

    it("applyAccepted with no accepted changes keeps boundVersion", () => {
      const current = DEFAULT_TEMPLATE;
      const next: OfficeTemplate = { ...DEFAULT_TEMPLATE, version: 2 };
      const b = createBinding("proj-1", current);
      const applied = applyAccepted(b, next, []);
      expect(applied.boundVersion).toBe(1);
    });
  });

  describe("provenanceLine", () => {
    it("clean binding shows just the standard name and version", () => {
      const b = createBinding("proj-1", DEFAULT_TEMPLATE);
      const line = provenanceLine(DEFAULT_TEMPLATE, b);
      expect(line).toContain("Curtis & Co standard");
      expect(line).toContain("v1");
      expect(line).not.toContain("override");
    });

    it("binding with overrides shows override count", () => {
      const b = createBinding("proj-1", DEFAULT_TEMPLATE);
      const withOverride = addOverride(b, {
        path: "codes",
        from: DEFAULT_TEMPLATE.codes,
        to: DEFAULT_TEMPLATE.codes,
        by: "Tim",
        at: "2026-01-15",
        reason: "test",
      });
      const line = provenanceLine(DEFAULT_TEMPLATE, withOverride);
      expect(line).toContain("1 override");
    });
  });
});
