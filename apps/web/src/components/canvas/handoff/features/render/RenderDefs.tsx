import { HATCH_IDS } from "./renderTokens";

type Props = {
  /** When true, night chalk strokes are included (always emit both for shared defs). */
  includeNight?: boolean;
};

/**
 * Shared SVG pattern library — mount ONCE inside the plan SVG `<defs>`.
 * Colours are tinted from existing StudioGlyph fills (stone / timber / chalk).
 */
export function RenderDefs({ includeNight = true }: Props) {
  return (
    <g data-testid="render-defs" aria-hidden>
      {/* Bluestone — coursed ashlar, staggered joints, fine 0.4 joints. */}
      <pattern
        id={HATCH_IDS.bluestone}
        width="18"
        height="12"
        patternUnits="userSpaceOnUse"
      >
        <rect width="18" height="12" fill="rgba(150, 150, 158, 0.14)" />
        <rect
          x="0.4"
          y="0.4"
          width="8.2"
          height="5.2"
          fill="none"
          stroke="rgba(94, 70, 80, 0.35)"
          strokeWidth="0.4"
        />
        <rect
          x="9.2"
          y="0.4"
          width="8.4"
          height="5.2"
          fill="none"
          stroke="rgba(94, 70, 80, 0.35)"
          strokeWidth="0.4"
        />
        <rect
          x="0.4"
          y="6.2"
          width="5.2"
          height="5.4"
          fill="none"
          stroke="rgba(94, 70, 80, 0.35)"
          strokeWidth="0.4"
        />
        <rect
          x="6.2"
          y="6.2"
          width="5.6"
          height="5.4"
          fill="none"
          stroke="rgba(94, 70, 80, 0.35)"
          strokeWidth="0.4"
        />
        <rect
          x="12.4"
          y="6.2"
          width="5.2"
          height="5.4"
          fill="none"
          stroke="rgba(94, 70, 80, 0.35)"
          strokeWidth="0.4"
        />
      </pattern>

      {/* Deck — parallel boards along local long axis (item rot spins the glyph). */}
      <pattern
        id={HATCH_IDS.deck}
        width="100"
        height="10"
        patternUnits="userSpaceOnUse"
      >
        <rect width="100" height="10" fill="rgba(192, 148, 104, 0.14)" />
        <line
          x1="0"
          y1="9.5"
          x2="100"
          y2="9.5"
          stroke="rgba(176, 138, 94, 0.55)"
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
        <rect width="14" height="14" fill="rgba(150, 150, 158, 0.06)" />
        <circle cx="3" cy="4" r="0.7" fill="rgba(94, 70, 80, 0.4)" />
        <circle cx="9" cy="3" r="0.55" fill="rgba(94, 70, 80, 0.32)" />
        <circle cx="6" cy="9" r="0.65" fill="rgba(94, 70, 80, 0.36)" />
        <circle cx="11" cy="11" r="0.5" fill="rgba(94, 70, 80, 0.28)" />
        <circle cx="2" cy="12" r="0.55" fill="rgba(94, 70, 80, 0.3)" />
      </pattern>

      {includeNight ? (
        <>
          <pattern
            id={HATCH_IDS.bluestoneNight}
            width="18"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <rect width="18" height="12" fill="rgba(236, 239, 244, 0.04)" />
            <rect
              x="0.4"
              y="0.4"
              width="8.2"
              height="5.2"
              fill="none"
              stroke="rgba(236, 239, 244, 0.28)"
              strokeWidth="0.4"
            />
            <rect
              x="9.2"
              y="0.4"
              width="8.4"
              height="5.2"
              fill="none"
              stroke="rgba(236, 239, 244, 0.28)"
              strokeWidth="0.4"
            />
            <rect
              x="0.4"
              y="6.2"
              width="5.2"
              height="5.4"
              fill="none"
              stroke="rgba(236, 239, 244, 0.28)"
              strokeWidth="0.4"
            />
            <rect
              x="6.2"
              y="6.2"
              width="5.6"
              height="5.4"
              fill="none"
              stroke="rgba(236, 239, 244, 0.28)"
              strokeWidth="0.4"
            />
            <rect
              x="12.4"
              y="6.2"
              width="5.2"
              height="5.4"
              fill="none"
              stroke="rgba(236, 239, 244, 0.28)"
              strokeWidth="0.4"
            />
          </pattern>
          <pattern
            id={HATCH_IDS.deckNight}
            width="100"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <rect width="100" height="10" fill="rgba(236, 239, 244, 0.04)" />
            <line
              x1="0"
              y1="9.5"
              x2="100"
              y2="9.5"
              stroke="rgba(236, 239, 244, 0.32)"
              strokeWidth="0.55"
            />
          </pattern>
          <pattern
            id={HATCH_IDS.gravelNight}
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <rect width="14" height="14" fill="rgba(236, 239, 244, 0.03)" />
            <circle cx="3" cy="4" r="0.7" fill="rgba(236, 239, 244, 0.35)" />
            <circle cx="9" cy="3" r="0.55" fill="rgba(236, 239, 244, 0.28)" />
            <circle cx="6" cy="9" r="0.65" fill="rgba(236, 239, 244, 0.3)" />
            <circle cx="11" cy="11" r="0.5" fill="rgba(236, 239, 244, 0.24)" />
            <circle cx="2" cy="12" r="0.55" fill="rgba(236, 239, 244, 0.26)" />
          </pattern>
        </>
      ) : null}
    </g>
  );
}
