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
  weightMmForSignature,
  type OfficeTemplate,
} from "./officeTemplate";
import { materialById } from "./materials";

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

  /**
   * The version a binding claims is printed on paper (17b), so it must not
   * run ahead of what was actually accepted.
   */
  describe("R.3 — a partial acceptance does not claim the whole version", () => {
    const v2: OfficeTemplate = {
      ...DEFAULT_TEMPLATE,
      version: 2,
      sheet: { ...DEFAULT_TEMPLATE.sheet, scale: 100 },
      codes: { ...DEFAULT_TEMPLATE.codes, tree: "TR" },
      defaults: { ...DEFAULT_TEMPLATE.defaults, snapM: 0.25 },
    };
    const binding = () => createBinding("p1", DEFAULT_TEMPLATE);

    it("offers every changed path", () => {
      const changes = diffForProject(DEFAULT_TEMPLATE, v2, binding());
      expect(changes.map((c) => c.path).sort()).toEqual([
        "codes",
        "defaults",
        "sheet",
      ]);
    });

    it("stays on the bound version when some changes are declined", () => {
      const offered = diffForProject(DEFAULT_TEMPLATE, v2, binding());
      const accepted = offered.filter((c) => c.path === "sheet");
      const after = applyAccepted(binding(), v2, accepted, offered, "Tim");
      expect(after.boundVersion).toBe(1);
      expect(provenanceLine(v2, after)).toContain("v1");
      expect(provenanceLine(v2, after)).not.toContain("v2");
    });

    it("records each declined change as a named override", () => {
      const offered = diffForProject(DEFAULT_TEMPLATE, v2, binding());
      const accepted = offered.filter((c) => c.path === "sheet");
      const after = applyAccepted(binding(), v2, accepted, offered, "Tim");
      expect(after.overrides.map((o) => o.path).sort()).toEqual([
        "codes",
        "defaults",
      ]);
      for (const o of after.overrides) {
        expect(o.by).toBe("Tim");
        expect(o.reason).toBeTruthy();
        expect(o.at).toBeTruthy();
      }
      expect(isClean(after)).toBe(false);
    });

    it("advances the version only when every change is accepted", () => {
      const offered = diffForProject(DEFAULT_TEMPLATE, v2, binding());
      const after = applyAccepted(binding(), v2, offered, offered, "Tim");
      expect(after.boundVersion).toBe(2);
      expect(after.overrides).toEqual([]);
      expect(isClean(after)).toBe(true);
    });

    it("accepting nothing changes nothing", () => {
      const offered = diffForProject(DEFAULT_TEMPLATE, v2, binding());
      const after = applyAccepted(binding(), v2, [], offered, "Tim");
      expect(after.boundVersion).toBe(1);
    });

    it("accepting a conflicting change clears its override", () => {
      const b = addOverride(binding(), {
        path: "sheet",
        from: DEFAULT_TEMPLATE.sheet,
        to: v2.sheet,
        by: "Tim",
        at: "2026-01-15",
        reason: "client wanted A0",
      });
      const offered = diffForProject(DEFAULT_TEMPLATE, v2, b);
      expect(offered.find((c) => c.path === "sheet")?.conflictsWithOverride).toBe(
        true,
      );
      const after = applyAccepted(b, v2, offered, offered, "Tim");
      expect(after.overrides.some((o) => o.path === "sheet")).toBe(false);
    });
  });

  describe("R.3 — every offered change states its consequence", () => {
    const v2: OfficeTemplate = {
      ...DEFAULT_TEMPLATE,
      version: 2,
      sheet: { ...DEFAULT_TEMPLATE.sheet, size: "A0", scale: 100 },
      codes: { ...DEFAULT_TEMPLATE.codes, tree: "TR" },
      defaults: { ...DEFAULT_TEMPLATE.defaults, snapM: 0.25 },
      materials: DEFAULT_TEMPLATE.materials.filter((m) => m !== "asphalt"),
      planes: DEFAULT_TEMPLATE.planes.slice(0, 3),
    };

    it("never emits a bare change with no stated consequence", () => {
      const changes = diffForProject(DEFAULT_TEMPLATE, v2, createBinding("p", DEFAULT_TEMPLATE));
      expect(changes.length).toBeGreaterThan(0);
      for (const c of changes) {
        expect(c.affects, `${c.path} has no stated consequence`).not.toBe("");
      }
    });

    it("counts the renumbering against this drawing", () => {
      const changes = diffForProject(
        DEFAULT_TEMPLATE,
        v2,
        createBinding("p", DEFAULT_TEMPLATE),
        { trees: 12, beds: 5, hardscape: 3, issuedSheets: 2 },
      );
      const codes = changes.find((c) => c.path === "codes")!;
      expect(codes.affects).toContain("20 coded items");
      expect(codes.affects).toContain("2 already-issued sheets");
      expect(codes.destructive).toBe(true);
      expect(defaultAccepted(codes)).toBe(false);
    });

    it("names the sheet delta", () => {
      const changes = diffForProject(DEFAULT_TEMPLATE, v2, createBinding("p", DEFAULT_TEMPLATE));
      const sheet = changes.find((c) => c.path === "sheet")!;
      expect(sheet.affects).toContain("A1 → A0");
      expect(sheet.affects).toContain("1:200 → 1:100");
    });

    it("names the material delta", () => {
      const changes = diffForProject(DEFAULT_TEMPLATE, v2, createBinding("p", DEFAULT_TEMPLATE));
      expect(changes.find((c) => c.path === "materials")!.affects).toContain(
        "1 withdrawn",
      );
    });

    it("gives each row a human label", () => {
      const changes = diffForProject(DEFAULT_TEMPLATE, v2, createBinding("p", DEFAULT_TEMPLATE));
      expect(changes.find((c) => c.path === "codes")!.label).toBe("Asset codes");
      expect(changes.find((c) => c.path === "planes")!.label).toBe("Plane stack");
    });
  });

  describe("R.4 — the standard's weight reaches the renderer", () => {
    const binding = () => createBinding("p", DEFAULT_TEMPLATE);

    it("resolves a weight by the material signature it governs", () => {
      expect(weightMmForSignature(DEFAULT_TEMPLATE, binding(), "setback")).toBe(0.5);
      expect(weightMmForSignature(DEFAULT_TEMPLATE, binding(), "survey")).toBe(0.25);
    });

    it("every template weight names a material that exists", () => {
      // The signature is the join to the palette. A weight governing nothing
      // is a convention the drawing can never honour.
      for (const w of DEFAULT_TEMPLATE.weights) {
        expect(materialById(w.signature), w.signature).toBeDefined();
      }
    });

    it("says nothing about a material the standard does not govern", () => {
      expect(weightMmForSignature(DEFAULT_TEMPLATE, binding(), "bluestone")).toBeUndefined();
    });

    it("a changed weight is what the renderer would read", () => {
      const heavier: OfficeTemplate = {
        ...DEFAULT_TEMPLATE,
        version: 2,
        weights: DEFAULT_TEMPLATE.weights.map((w) =>
          w.purpose === "setback" ? { ...w, mm: 1.2 } : w,
        ),
      };
      expect(weightMmForSignature(heavier, binding(), "setback")).toBe(1.2);
      // Untouched purposes keep the standard they had.
      expect(weightMmForSignature(heavier, binding(), "gas")).toBe(0.35);
    });

    it("an override on weights withdraws the standard rather than guessing", () => {
      // Rule 2 — this project declined the weight set, so the renderer falls
      // back to the palette baseline instead of drawing a standard the
      // project is not following.
      const deviating = addOverride(binding(), {
        path: "weights",
        from: DEFAULT_TEMPLATE.weights,
        to: 1,
        by: "operator",
        at: "2026-09-04T00:00:00.000Z",
        reason: null,
      });
      expect(weightMmForSignature(DEFAULT_TEMPLATE, deviating, "setback")).toBeUndefined();
      // Reverting it returns the project to the standard.
      expect(
        weightMmForSignature(DEFAULT_TEMPLATE, revertOverride(deviating, "weights"), "setback"),
      ).toBe(0.5);
    });

    it("an override on another path leaves weights governed", () => {
      const deviating = addOverride(binding(), {
        path: "sheet",
        from: DEFAULT_TEMPLATE.sheet,
        to: 1,
        by: "operator",
        at: "2026-09-04T00:00:00.000Z",
        reason: "A0 for the client meeting",
      });
      expect(weightMmForSignature(DEFAULT_TEMPLATE, deviating, "setback")).toBe(0.5);
    });
  });
});
