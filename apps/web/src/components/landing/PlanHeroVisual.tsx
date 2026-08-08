import css from "./planHeroVisual.module.css";

/**
 * Full-bleed site-plan mark for the landing stage — chalk vectors on ink,
 * not a photo collage. Decorative only.
 */
export function PlanHeroVisual() {
  return (
    <svg
      className={css.svg}
      viewBox="0 0 1200 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id="planWash" cx="62%" cy="38%" r="70%">
          <stop
            className={css.stopWashCenter}
            offset="0%"
            stopOpacity="0.22"
          />
          <stop
            className={css.stopWashMid}
            offset="45%"
            stopOpacity="0.08"
          />
          <stop
            className={css.stopWashEdge}
            offset="100%"
            stopOpacity="0"
          />
        </radialGradient>
        <linearGradient id="planFade" x1="0" y1="0" x2="0" y2="1">
          <stop
            className={css.stopFadeTop}
            offset="0%"
            stopOpacity="0.15"
          />
          <stop
            className={css.stopFadeBottom}
            offset="100%"
            stopOpacity="0.75"
          />
        </linearGradient>
      </defs>

      <rect className={css.base} width="1200" height="900" />
      <rect width="1200" height="900" fill="url(#planWash)" />

      {/* Lot boundary */}
      <path
        className={`${css.strokeDraw} ${css.lot}`}
        d="M210 160 L980 140 L1020 720 L180 740 Z"
        strokeWidth="2.2"
      />

      {/* Dwelling */}
      <path
        className={`${css.strokeDrawSlow} ${css.dwelling}`}
        d="M340 280 L720 265 L735 520 L355 535 Z"
        strokeWidth="2"
      />

      {/* Soft landscape mass */}
      <path
        className={`${css.strokeDraw} ${css.mass}`}
        d="M760 310 C880 300 940 390 930 470 C920 560 820 590 740 560 C680 535 690 430 760 310 Z"
        strokeWidth="1.5"
      />

      {/* Path */}
      <path
        className={`${css.strokeDrawSlow} ${css.path}`}
        d="M420 535 C480 610 560 640 680 655"
        strokeWidth="10"
        strokeLinecap="round"
      />

      {/* Plant marks */}
      <g
        className={`${css.plants} ${css.plantMarks}`}
        strokeWidth="1.4"
      >
        <circle cx="280" cy="620" r="18" />
        <circle cx="330" cy="660" r="12" />
        <circle cx="860" cy="240" r="16" />
        <circle cx="910" cy="280" r="10" />
        <circle cx="250" cy="340" r="14" />
      </g>

      {/* Dim tick */}
      <g className={`${css.dims} ${css.dimTicks}`} strokeWidth="1">
        <path d="M210 160 L210 120" />
        <path d="M980 140 L980 100" />
        <path d="M210 120 L980 100" />
      </g>

      <rect width="1200" height="900" fill="url(#planFade)" />
    </svg>
  );
}
