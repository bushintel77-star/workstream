import Svg, { Path } from "react-native-svg";
import type { CatalogSymbol } from "@workstream/contracts";
import { tokens } from "@workstream/ui";

const SIZES = { sm: 28, md: 40, lg: 52, pin: 36 } as const;

type Props = {
  symbol: CatalogSymbol;
  size?: keyof typeof SIZES;
};

export function DesignAssetGlyph({ symbol, size = "md" }: Props) {
  const dim = SIZES[size];
  const asset = symbol.asset;

  if (asset?.layers?.length) {
    return (
      <Svg width={dim} height={dim} viewBox={asset.view_box}>
        {asset.layers.map((layer, i) => (
          <Path
            key={`${symbol.id}-${i}`}
            d={layer.d}
            fill={layer.fill ?? "none"}
            stroke={layer.stroke}
            strokeWidth={layer.stroke_width}
            opacity={layer.opacity}
          />
        ))}
      </Svg>
    );
  }

  return (
    <Svg width={dim} height={dim} viewBox="0 0 24 24">
      <Path
        d={symbol.path_d}
        stroke={tokens.color.ink.primary}
        strokeWidth={1.4}
        fill="none"
      />
    </Svg>
  );
}
