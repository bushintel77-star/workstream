"use client";

import { formatScheduleAreaM2 } from "../../geometry/siteScheduleDisplay";
import { MetaIcon } from "./MetaIcon";
import type { SiteLiveMeta } from "./siteLiveMeta";
import css from "./metaPanel.module.css";

type Props = {
  open: boolean;
  meta: SiteLiveMeta;
  /** Turf workable outdoor remnant (m²) — lot − building − exclusions. */
  outdoorM2?: number | null;
  onClose: () => void;
};

/**
 * Expanded Site lane — lot facts + Vicmap honesty (title ≠ underground assets).
 * Blush frost body (shared metaPanel tokens); Close on the same boundary seam.
 */
export function SiteMetaPanel({ open, meta, outdoorM2 = null, onClose }: Props) {
  if (!open) return null;

  const areaLabel =
    meta.lotAreaM2 > 0
      ? `${formatScheduleAreaM2(meta.lotAreaM2)} m²`
      : "—";
  const outdoorLabel =
    outdoorM2 != null && outdoorM2 > 0
      ? `${formatScheduleAreaM2(outdoorM2)} m²`
      : "—";

  return (
    <div
      className={css.panel}
      data-testid="site-meta-panel"
      role="dialog"
      aria-label="Site"
    >
      <div className={css.head}>
        <div className={css.headMain}>
          <span className={css.headIcon}>
            <MetaIcon id="site" size={20} />
          </span>
          <div>
            <p className={css.kicker}>Cadastral · indicative</p>
            <h2 className={css.title}>Site</h2>
          </div>
        </div>
        <button type="button" className={css.close} onClick={onClose}>
          Close
        </button>
      </div>

      <p className={css.live} data-testid="site-meta-panel-live">
        <span className={css.metric}>{areaLabel}</span>
        <span>
          {meta.areaSurveyed
            ? `${meta.titleSource ?? "Title"} lot area`
            : "Indicative from boundary trace"}
        </span>
      </p>

      <div className={css.grid}>
        <div className={css.stat}>
          <span className={css.statLabel}>Lot area</span>
          <span className={css.statValue}>{areaLabel}</span>
        </div>
        <div className={css.stat}>
          <span className={css.statLabel}>Outdoor</span>
          <span className={css.statValue}>{outdoorLabel}</span>
        </div>
        <div className={css.stat}>
          <span className={css.statLabel}>Dwelling</span>
          <span className={css.statValue}>{meta.hasDwelling ? "Yes" : "No"}</span>
        </div>
        <div className={css.stat}>
          <span className={css.statLabel}>Easements</span>
          <span className={css.statValue}>{meta.easementCount}</span>
        </div>
      </div>

      <p className={css.honesty} data-testid="site-meta-panel-honesty">
        Vicmap title boundary ≠ underground assets. Areas are indicative
        Workflow 1 — confirm against survey / plan of subdivision before quoting.
      </p>

      <p className={css.foot}>
        Sticky card stays until you dismiss it. Trace boundary / building in
        Survey to refine these figures.
      </p>
    </div>
  );
}
