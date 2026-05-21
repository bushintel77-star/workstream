import type { CatalogAsset, CatalogSymbol } from "@workstream/contracts";

/** Build a palette glyph from a single SVG path (uploaded assets). */
export function assetFromPathD(
  path_d: string,
  opts?: { preview_bg?: string; accent?: string },
): CatalogAsset {
  return {
    view_box: "0 0 48 48",
    layers: [
      {
        d: path_d,
        fill: "none",
        stroke: opts?.accent ?? "#4a6741",
        stroke_width: 1.6,
      },
    ],
    preview_bg: opts?.preview_bg ?? "#f0f2ee",
    accent: opts?.accent ?? "#4a6741",
  };
}

export function symbolFromUpload(
  id: string,
  input: {
    label: string;
    category: CatalogSymbol["category"];
    path_d: string;
    description?: string;
    rate_card_sku?: string;
    preview_bg?: string;
    accent?: string;
  },
): CatalogSymbol {
  return {
    id,
    label: input.label,
    category: input.category,
    path_d: input.path_d,
    description: input.description,
    keywords: [input.label.toLowerCase(), input.category],
    rate_card_sku: input.rate_card_sku,
    asset: assetFromPathD(input.path_d, {
      preview_bg: input.preview_bg,
      accent: input.accent,
    }),
  };
}
