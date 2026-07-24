import { HATCH_IDS } from "./renderTokens";

type Props = {
  /** When true, night chalk strokes are included (always emit both for shared defs). */
  includeNight?: boolean;
};

const STONE_FILL = "color-mix(in srgb, var(--bluestone-l-400) 14%, var(--canvas))";
const STONE_STROKE =
  "color-mix(in srgb, var(--bluestone-l-400) 45%, var(--text-primary))";
const TIMBER_FILL = "color-mix(in srgb, var(--timber-l-400) 14%, var(--canvas))";
const TIMBER_STROKE =
  "color-mix(in srgb, var(--timber-l-400) 55%, var(--text-primary))";
const GRAVEL_FILL = "color-mix(in srgb, var(--gravel-l-400) 8%, var(--canvas))";
const GRAVEL_DOT = "color-mix(in srgb, var(--text-muted) 55%, var(--canvas))";
const NIGHT_FILL = "color-mix(in srgb, var(--text-primary) 4%, var(--canvas))";
const NIGHT_STROKE =
  "color-mix(in srgb, var(--text-primary) 28%, transparent)";

/**
 * Shared SVG pattern library — mount ONCE inside the plan SVG `<defs>`.
 * Materials from color-tokens v2 (bluestone / timber / gravel), not blush ink.
 */
export function RenderDefs({ includeNight = true }: Props) {
  return (
    <g data-testid="render-defs" aria-hidden>
      {/* Bluestone — coursed ashlar, staggered joints. */}
      <pattern
        id={HATCH_IDS.bluestone}
        width="18"
        height="12"
        patternUnits="userSpaceOnUse"
      >
        <rect width="18" height="12" fill={STONE_FILL} />
        <rect
          x="0.4"
          y="0.4"
          width="8.2"
          height="5.2"
          fill="none"
          stroke={STONE_STROKE}
          strokeWidth="0.4"
        />
        <rect
          x="9.2"
          y="0.4"
          width="8.4"
          height="5.2"
          fill="none"
          stroke={STONE_STROKE}
          strokeWidth="0.4"
        />
        <rect
          x="0.4"
          y="6.2"
          width="5.2"
          height="5.4"
          fill="none"
          stroke={STONE_STROKE}
          strokeWidth="0.4"
        />
        <rect
          x="6.2"
          y="6.2"
          width="5.6"
          height="5.4"
          fill="none"
          stroke={STONE_STROKE}
          strokeWidth="0.4"
        />
        <rect
          x="12.4"
          y="6.2"
          width="5.2"
          height="5.4"
          fill="none"
          stroke={STONE_STROKE}
          strokeWidth="0.4"
        />
      </pattern>

      {/* Deck — parallel boards along local long axis. */}
      <pattern
        id={HATCH_IDS.deck}
        width="100"
        height="10"
        patternUnits="userSpaceOnUse"
      >
        <rect width="100" height="10" fill={TIMBER_FILL} />
        <line
          x1="0"
          y1="9.5"
          x2="100"
          y2="9.5"
          stroke={TIMBER_STROKE}
          strokeWidth="0.55"
        />
      </pattern>

      {/* Gravel — sparse stipple. */}
      <pattern
        id={HATCH_IDS.gravel}
        width="14"
        height="14"
        patternUnits="userSpaceOnUse"
      >
        <rect width="14" height="14" fill={GRAVEL_FILL} />
        <circle cx="3" cy="4" r="0.7" fill={GRAVEL_DOT} />
        <circle cx="9" cy="3" r="0.55" fill={GRAVEL_DOT} />
        <circle cx="6" cy="9" r="0.65" fill={GRAVEL_DOT} />
        <circle cx="11" cy="11" r="0.5" fill={GRAVEL_DOT} />
        <circle cx="2" cy="12" r="0.55" fill={GRAVEL_DOT} />
      </pattern>

      {includeNight ? (
        <>
          <pattern
            id={HATCH_IDS.bluestoneNight}
            width="18"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <rect width="18" height="12" fill={NIGHT_FILL} />
            <rect
              x="0.4"
              y="0.4"
              width="8.2"
              height="5.2"
              fill="none"
              stroke={NIGHT_STROKE}
              strokeWidth="0.4"
            />
            <rect
              x="9.2"
              y="0.4"
              width="8.4"
              height="5.2"
              fill="none"
              stroke={NIGHT_STROKE}
              strokeWidth="0.4"
            />
            <rect
              x="0.4"
              y="6.2"
              width="5.2"
              height="5.4"
              fill="none"
              stroke={NIGHT_STROKE}
              strokeWidth="0.4"
            />
            <rect
              x="6.2"
              y="6.2"
              width="5.6"
              height="5.4"
              fill="none"
              stroke={NIGHT_STROKE}
              strokeWidth="0.4"
            />
            <rect
              x="12.4"
              y="6.2"
              width="5.2"
              height="5.4"
              fill="none"
              stroke={NIGHT_STROKE}
              strokeWidth="0.4"
            />
          </pattern>
          <pattern
            id={HATCH_IDS.deckNight}
            width="100"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <rect width="100" height="10" fill={NIGHT_FILL} />
            <line
              x1="0"
              y1="9.5"
              x2="100"
              y2="9.5"
              stroke={NIGHT_STROKE}
              strokeWidth="0.55"
            />
          </pattern>
          <pattern
            id={HATCH_IDS.gravelNight}
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <rect width="14" height="14" fill={NIGHT_FILL} />
            <circle cx="3" cy="4" r="0.7" fill={NIGHT_STROKE} />
            <circle cx="9" cy="3" r="0.55" fill={NIGHT_STROKE} />
            <circle cx="6" cy="9" r="0.65" fill={NIGHT_STROKE} />
            <circle cx="11" cy="11" r="0.5" fill={NIGHT_STROKE} />
            <circle cx="2" cy="12" r="0.55" fill={NIGHT_STROKE} />
          </pattern>
        </>
      ) : null}
    </g>
  );
}
