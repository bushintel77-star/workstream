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
 * Ink for the material families added alongside the garden asset pass.
 * Composed from the three v2 material tokens (bluestone / timber / gravel) —
 * no new tokens, no literal hex (CI gate `check-handoff-chrome-colors`).
 */
type HatchInk = {
  fill: string;
  stroke: string;
  speck: string;
};

const STONE_INK: HatchInk = {
  fill: "color-mix(in srgb, var(--bluestone-l-400) 18%, var(--canvas))",
  stroke: "color-mix(in srgb, var(--bluestone-l-400) 50%, var(--text-primary))",
  speck: "color-mix(in srgb, var(--bluestone-l-400) 40%, var(--canvas))",
};

const EARTH_INK: HatchInk = {
  fill: "color-mix(in srgb, var(--gravel-l-400) 14%, var(--canvas))",
  stroke: "color-mix(in srgb, var(--gravel-l-400) 45%, var(--text-primary))",
  speck: "color-mix(in srgb, var(--text-muted) 45%, var(--canvas))",
};

const PALE_INK: HatchInk = {
  fill: "color-mix(in srgb, var(--gravel-l-400) 8%, var(--canvas))",
  stroke: "color-mix(in srgb, var(--gravel-l-400) 38%, var(--text-primary))",
  speck: "color-mix(in srgb, var(--text-muted) 32%, var(--canvas))",
};

const NIGHT_INK: HatchInk = {
  fill: NIGHT_FILL,
  stroke: NIGHT_STROKE,
  speck: NIGHT_STROKE,
};

/** Large-format porcelain — wide plate, tight joint. */
function PorcelainHatch({ id, ink }: { id: string; ink: HatchInk }) {
  return (
    <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
      <rect width="24" height="24" fill={ink.fill} />
      <path
        d="M0 23.6h24M23.6 0v24"
        stroke={ink.stroke}
        strokeWidth="0.45"
        fill="none"
      />
    </pattern>
  );
}

/** Granite steppers — discrete pads, ground reads between them. */
function StepperHatch({ id, ink }: { id: string; ink: HatchInk }) {
  return (
    <pattern id={id} width="22" height="16" patternUnits="userSpaceOnUse">
      <rect
        x="1.5"
        y="1.5"
        width="14"
        height="10"
        rx="1"
        fill={ink.fill}
        stroke={ink.stroke}
        strokeWidth="0.5"
      />
    </pattern>
  );
}

/** Crazy-pave sandstone — irregular facets, no repeating joint grid. */
function CrazyPaveHatch({ id, ink }: { id: string; ink: HatchInk }) {
  return (
    <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
      <rect width="20" height="20" fill={ink.fill} />
      <path
        d="M0 6l7 3 5-4 8 5M0 15l6-2 5 4 9-3M7 9v6M12 5v8"
        stroke={ink.stroke}
        strokeWidth="0.4"
        fill="none"
      />
    </pattern>
  );
}

/** Exposed aggregate — dense fine stipple over a warm base. */
function AggregateHatch({ id, ink }: { id: string; ink: HatchInk }) {
  return (
    <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill={ink.fill} />
      <circle cx="2" cy="3" r="0.55" fill={ink.speck} />
      <circle cx="6" cy="1.5" r="0.42" fill={ink.speck} />
      <circle cx="9.5" cy="4" r="0.5" fill={ink.speck} />
      <circle cx="4" cy="7" r="0.48" fill={ink.speck} />
      <circle cx="8" cy="9" r="0.4" fill={ink.speck} />
      <circle cx="11" cy="10.5" r="0.45" fill={ink.speck} />
    </pattern>
  );
}

/** Hoggin — compacted fines, faint grain, almost no texture. */
function HogginHatch({ id, ink }: { id: string; ink: HatchInk }) {
  return (
    <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill={ink.fill} />
      <path
        d="M0 5h10"
        stroke={ink.stroke}
        strokeWidth="0.3"
        opacity="0.35"
        fill="none"
      />
      <circle cx="3" cy="2.5" r="0.32" fill={ink.speck} />
      <circle cx="7.5" cy="7" r="0.3" fill={ink.speck} />
    </pattern>
  );
}

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

      {/* Curtis hardscape families — one hatch per material. */}
      <PorcelainHatch id={HATCH_IDS.porcelain} ink={PALE_INK} />
      <StepperHatch id={HATCH_IDS.stepper} ink={STONE_INK} />
      <CrazyPaveHatch id={HATCH_IDS.crazypave} ink={EARTH_INK} />
      <AggregateHatch id={HATCH_IDS.aggregate} ink={EARTH_INK} />
      <HogginHatch id={HATCH_IDS.hoggin} ink={PALE_INK} />

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
          <PorcelainHatch id={HATCH_IDS.porcelainNight} ink={NIGHT_INK} />
          <StepperHatch id={HATCH_IDS.stepperNight} ink={NIGHT_INK} />
          <CrazyPaveHatch id={HATCH_IDS.crazypaveNight} ink={NIGHT_INK} />
          <AggregateHatch id={HATCH_IDS.aggregateNight} ink={NIGHT_INK} />
          <HogginHatch id={HATCH_IDS.hogginNight} ink={NIGHT_INK} />
        </>
      ) : null}
      {/* Graphite tooth for freehand Fit pen (shared defs). */}
      <filter
        id="ws-pencil-grain-shared"
        x="-8%"
        y="-8%"
        width="116%"
        height="116%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          seed="7"
          result="noise"
        />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0.15  0 0 0 0 0.14  0 0 0 0 0.12  0 0 0 0.35 0"
          result="grain"
        />
        <feComposite in="SourceGraphic" in2="grain" operator="over" />
      </filter>
    </g>
  );
}
