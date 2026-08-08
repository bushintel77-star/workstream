import {
  SEMANTIC_DARK,
  SEMANTIC_LIGHT,
  mixOnHex,
} from "../../../../../styles/colorTokens";
import { ELEV_TEXTURE_IDS } from "../render/renderTokens";

/**
 * Elevation silhouette textures — mount ONCE inside the elevation SVG `<defs>`.
 *
 * Tiles are deliberately fine: an elevation bar is only a couple of viewBox
 * units wide, so the plan hatches (18x12) would show as a single flat block.
 * Deterministic geometry only — no Math.random.
 *
 * `GardenElevationGlyph` paints a flat token wash *under* every textured shape,
 * so a silhouette still reads correctly if these defs are ever missing.
 */

type TextureInk = {
  foliage: string;
  timber: string;
  clip: string;
};

function inkFor(dark: boolean): TextureInk {
  const s = dark ? SEMANTIC_DARK : SEMANTIC_LIGHT;
  return {
    foliage: mixOnHex(s.plantingNewStroke, 55, s.canvas),
    timber: mixOnHex(s.timber, 60, s.canvas),
    clip: mixOnHex(s.hedge, 45, s.canvas),
  };
}

/** Leaf stipple for tree crowns and pleached panels. */
function FoliageTexture({ id, ink }: { id: string; ink: string }) {
  return (
    <pattern id={id} width="2" height="2" patternUnits="userSpaceOnUse">
      <circle cx="0.5" cy="0.6" r="0.26" fill={ink} />
      <circle cx="1.45" cy="1.5" r="0.22" fill={ink} />
    </pattern>
  );
}

/** Horizontal board grain for deck plates. */
function TimberTexture({ id, ink }: { id: string; ink: string }) {
  return (
    <pattern id={id} width="3" height="1.1" patternUnits="userSpaceOnUse">
      <line
        x1="0"
        y1="1"
        x2="3"
        y2="1"
        stroke={ink}
        strokeWidth="0.16"
        vectorEffect="non-scaling-stroke"
      />
    </pattern>
  );
}

/** Fine vertical clip texture for maintained hedge faces. */
function ClipTexture({ id, ink }: { id: string; ink: string }) {
  return (
    <pattern id={id} width="1.4" height="1.4" patternUnits="userSpaceOnUse">
      <line
        x1="0.7"
        y1="0.15"
        x2="0.7"
        y2="1.25"
        stroke={ink}
        strokeWidth="0.14"
        vectorEffect="non-scaling-stroke"
      />
    </pattern>
  );
}

export function ElevationTextureDefs() {
  const day = inkFor(false);
  const night = inkFor(true);
  return (
    <g data-testid="elevation-texture-defs" aria-hidden>
      <FoliageTexture id={ELEV_TEXTURE_IDS.foliage} ink={day.foliage} />
      <TimberTexture id={ELEV_TEXTURE_IDS.timber} ink={day.timber} />
      <ClipTexture id={ELEV_TEXTURE_IDS.clip} ink={day.clip} />
      <FoliageTexture id={ELEV_TEXTURE_IDS.foliageNight} ink={night.foliage} />
      <TimberTexture id={ELEV_TEXTURE_IDS.timberNight} ink={night.timber} />
      <ClipTexture id={ELEV_TEXTURE_IDS.clipNight} ink={night.clip} />
    </g>
  );
}
