export type ConfidenceFactor = {
  label: string;
  pct: number;
};

function hashStable(id: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 100) / 100;
}

/** Deterministic factor breakdown from suggestion id + overall score. */
export function deriveConfidenceFactors(
  id: string,
  overall: number,
  category: "tree" | "hardscape" | "drainage" | "generic",
): ConfidenceFactor[] {
  const base = Math.round(overall * 100);
  const templates: Record<typeof category, [string, string, string]> = {
    tree: ["Sun exposure", "Canopy target", "Root clearance"],
    hardscape: ["Access & fall", "Permeability impact", "Cost efficiency"],
    drainage: ["Drainage intercept", "Permeability impact", "Cost efficiency"],
    generic: ["Site fit", "Schedule impact", "Cost efficiency"],
  };
  const labels = templates[category];
  const weights = labels.map((_, i) => 0.55 + hashStable(id, i + 1) * 0.45);
  const sum = weights.reduce((a, b) => a + b, 0);
  return labels.map((label, i) => ({
    label,
    pct: Math.min(100, Math.max(5, Math.round((base * weights[i]!) / sum))),
  }));
}

export function ghostCategoryFromSymbol(
  symbolId: string,
  label: string,
): "tree" | "hardscape" | "drainage" | "generic" {
  const s = `${symbolId} ${label}`.toLowerCase();
  if (/drain|french|storm/.test(s)) return "drainage";
  if (/pav|deck|hard|bluestone|concrete/.test(s)) return "hardscape";
  if (/tree|canopy|hedge|plant|lawn|bed/.test(s)) return "tree";
  return "generic";
}
