/**
 * Technical Fit-sheet CAD furniture — scale bar, status stamp, hatch key.
 * Gated to the technical pen (working-drawing honesty).
 */

import css from "./sheetFurniture.module.css";

export type SheetFurnitureProps = {
  /** Board width in metres (working-plan). */
  scaleM: number;
  /** Paper frame width in CSS px — bar length is derived from this. */
  frameWidthPx: number;
  /** Show status stamp (technical pen). */
  technical: boolean;
};

const SCALE_NICE = [1, 2, 5, 10, 20, 50, 100] as const;

function pickBarMetres(scaleM: number, frameWidthPx: number): {
  metres: number;
  barPct: number;
} {
  const targetPx = Math.min(140, Math.max(64, frameWidthPx * 0.18));
  const mpp = scaleM / Math.max(frameWidthPx, 1);
  let best: number = SCALE_NICE[0]!;
  for (const m of SCALE_NICE) {
    const px = m / mpp;
    if (px <= targetPx) best = m;
  }
  const barPx = Math.max(28, best / mpp);
  return { metres: best, barPct: (barPx / Math.max(frameWidthPx, 1)) * 100 };
}

const HATCH_KEY: Array<{ id: string; label: string; swatch: string }> = [
  { id: "dwelling", label: "Dwelling", swatch: "dwelling" },
  { id: "hardscape", label: "Hardscape", swatch: "hardscape" },
  { id: "easement", label: "Easement", swatch: "easement" },
  { id: "planting", label: "Planting", swatch: "planting" },
];

/**
 * Paper-ink furniture for the Fit schedule panel / frame edge.
 */
export function SheetFurniture({
  scaleM,
  frameWidthPx,
  technical,
}: SheetFurnitureProps) {
  if (!technical || !(scaleM > 0) || !(frameWidthPx > 0)) return null;
  const bar = pickBarMetres(scaleM, frameWidthPx);

  return (
    <div className={css.root} data-testid="sheet-furniture">
      <div
        className={css.scaleBar}
        data-testid="sheet-graphic-scale"
        title="Working plan metres — confirm on site"
      >
        <div
          className={css.scaleTrack}
          style={{ width: `${Math.min(42, Math.max(12, bar.barPct))}%` }}
        >
          <span className={css.scaleTick} data-end="0" />
          <span className={css.scaleTick} data-end="1" />
        </div>
        <span className={css.scaleLabel}>{bar.metres} m</span>
      </div>

      <div className={css.statusStamp} data-testid="sheet-status-stamp">
        <span className={css.statusBadge}>Working drawing</span>
        <span className={css.statusHonesty}>
          Indicative — not for construction · confirm on site
        </span>
      </div>

      <div className={css.hatchKey} data-testid="sheet-hatch-key">
        <p className={css.hatchKicker}>Hatch key</p>
        <ul className={css.hatchList}>
          {HATCH_KEY.map((row) => (
            <li key={row.id} data-swatch={row.swatch}>
              <span className={css.hatchSwatch} aria-hidden />
              <span>{row.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
