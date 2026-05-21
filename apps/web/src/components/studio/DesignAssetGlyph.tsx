import type { CatalogSymbol } from "../../lib/api";
import s from "./designAssetGlyph.module.css";

type Props = {
  symbol: CatalogSymbol;
  size?: "sm" | "md" | "lg" | "pin";
  className?: string;
};

export function DesignAssetGlyph({ symbol, size = "md", className }: Props) {
  const asset = symbol.asset;
  const viewBox = asset?.view_box ?? "0 0 24 24";
  const accent = asset?.accent ?? "currentColor";

  if (asset?.layers?.length) {
    return (
      <svg
        className={`${s.glyph} ${s[size]} ${className ?? ""}`}
        viewBox={viewBox}
        aria-hidden
        focusable="false"
      >
        {asset.layers.map((layer, i) => (
          <path
            key={`${symbol.id}-${i}`}
            d={layer.d}
            fill={layer.fill ?? "none"}
            stroke={layer.stroke}
            strokeWidth={layer.stroke_width}
            opacity={layer.opacity}
          />
        ))}
      </svg>
    );
  }

  return (
    <svg
      className={`${s.glyph} ${s[size]} ${className ?? ""}`}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ color: accent }}
    >
      <path
        d={symbol.path_d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
      />
    </svg>
  );
}
