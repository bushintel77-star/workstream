import type { DesignCanvas } from "@workstream/contracts";

export type ApplyShadowResult = {
  canvas: DesignCanvas;
  note: string;
};

/**
 * Apply a shadow-ledger alternative to the sketch canvas.
 * Deterministic geometry / material nudges — designer remains in control.
 */
export function applyShadowAlternative(
  canvas: DesignCanvas,
  altId: string,
): ApplyShadowResult {
  if (altId === "alt-solar-lighting") {
    const placements = canvas.placements.map((p) => {
      const id = p.symbol_id.toLowerCase();
      const label = (p.label ?? "").toLowerCase();
      if (!id.includes("light") && !label.includes("light")) return p;
      return {
        ...p,
        symbol_id: "path-light-solar",
        label: p.label ? `${p.label} (solar)` : "Solar path light",
      };
    });
    return {
      canvas: { ...canvas, placements },
      note: "Swapped lighting pins to solar path lights where labelled.",
    };
  }

  if (altId === "alt-permeable-paving") {
    const placements = canvas.placements.map((p, i) => {
      const id = p.symbol_id.toLowerCase();
      const label = (p.label ?? "").toLowerCase();
      const isPave =
        id.includes("pav") ||
        id.includes("path") ||
        label.includes("pav") ||
        label.includes("path");
      if (!isPave) return p;
      // Keep first paving pin as primary; soften the rest.
      if (i === canvas.placements.findIndex((x) => {
        const sid = x.symbol_id.toLowerCase();
        const lab = (x.label ?? "").toLowerCase();
        return (
          sid.includes("pav") ||
          sid.includes("path") ||
          lab.includes("pav") ||
          lab.includes("path")
        );
      })) {
        return p;
      }
      return {
        ...p,
        symbol_id: "permeable-paving",
        label: p.label ? `${p.label} (permeable)` : "Permeable paving",
      };
    });
    const features = (canvas.features ?? []).map((f) => {
      const name = (f.metadata.friendly_name ?? "").toLowerCase();
      if (!name.includes("path") || !f.material_fill) return f;
      return {
        ...f,
        material_fill: {
          ...f.material_fill,
          sku: "PAVE-PERMEABLE",
          depth_m: Math.min(f.material_fill.depth_m, 0.06),
        },
        metadata: {
          ...f.metadata,
          friendly_name: `${f.metadata.friendly_name ?? "Path"} (permeable)`,
        },
      };
    });
    return {
      canvas: { ...canvas, placements, features },
      note: "Secondary paths marked permeable with reduced base depth.",
    };
  }

  if (altId === "alt-setback-geometry") {
    const trees = canvas.placements.filter(
      (p) =>
        p.symbol_id.includes("tree") ||
        (p.label ?? "").toLowerCase().includes("tree"),
    );
    const placements = canvas.placements.map((p) => {
      const hard =
        p.symbol_id.includes("pav") ||
        p.symbol_id.includes("wall") ||
        p.symbol_id.includes("path") ||
        (p.label ?? "").toLowerCase().includes("pav");
      if (!hard || trees.length === 0) return p;
      let dx = 0;
      let dy = 0;
      for (const t of trees) {
        const d = Math.hypot(p.x_pct - t.x_pct, p.y_pct - t.y_pct);
        if (d < 8 && d > 0.01) {
          dx += ((p.x_pct - t.x_pct) / d) * 2.5;
          dy += ((p.y_pct - t.y_pct) / d) * 2.5;
        }
      }
      if (dx === 0 && dy === 0) return p;
      return {
        ...p,
        x_pct: Math.min(98, Math.max(2, p.x_pct + dx)),
        y_pct: Math.min(98, Math.max(2, p.y_pct + dy)),
      };
    });
    return {
      canvas: { ...canvas, placements },
      note: "Nudged hardscape pins clear of nearby tree root zones.",
    };
  }

  return { canvas, note: "No canvas change for this alternative." };
}
