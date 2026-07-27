"use client";

import { useMemo } from "react";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import { polygonAreaM2, type PctPoint } from "../../geometry";
import css from "./compliance.module.css";
import { CSS_TOKEN } from "../../../../../styles/colorTokens";

type Props = {
  outdoorM2: number;
  boundary: PctPoint[];
  items: StudioItem[];
  scaleM?: number;
  /** Render without absolute dock chrome (utility drawer sheet). */
  embedded?: boolean;
};

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

export function ComplianceDock({
  outdoorM2,
  boundary,
  items,
  scaleM = 110,
  embedded = false,
}: Props) {
  const stats = useMemo(() => {
    const live = items.filter((i) => !i.ghost);
    const site = Math.max(outdoorM2, polygonAreaM2(boundary, scaleM) || outdoorM2);

    let permeableM2 = 0;
    let hardM2 = 0;
    let canopyM2 = 0;

    for (const it of live) {
      const d = BY_TYPE[it.t];
      const wm = (d.w * it.scale) / 40;
      const hm = (d.h * it.scale) / 40;
      const area =
        d.area === "ellipse"
          ? (Math.PI / 4) * wm * hm
          : d.area === "rect"
            ? wm * hm
            : 0;
      if (it.t === "lawn" || it.t === "bed") permeableM2 += area || site * 0.08;
      if (it.t === "paving" || it.t === "deck") hardM2 += area || site * 0.05;
      if (d.canopyM) {
        const r = (d.canopyM * it.scale) / 2;
        canopyM2 += Math.PI * r * r;
      }
    }

    // Seeded Wrights demo targets when geometry is sparse
    const permeablePct = clampPct(
      permeableM2 > 0 || hardM2 > 0
        ? (permeableM2 / Math.max(site, permeableM2 + hardM2)) * 100
        : 54,
    );
    const canopyPct = clampPct(
      canopyM2 > 0 ? (canopyM2 / site) * 100 : 15,
    );

    const permeableOk = permeablePct >= 20;
    const canopyOk = canopyPct >= 15;
    const outdoorOk = site >= 40;
    const pass = [outdoorOk, permeableOk, canopyOk].filter(Boolean).length;

    return {
      site,
      permeablePct,
      canopyPct,
      permeableOk,
      canopyOk,
      outdoorOk,
      pass,
      total: 3,
    };
  }, [boundary, items, outdoorM2, scaleM]);

  return (
    <aside
      className={`${css.dock}${embedded ? ` ${css.embedded}` : ""}`}
      data-testid="compliance-dock"
    >
      {!embedded ? (
        <div className={css.head}>
          <p className={css.kicker}>Compliance</p>
          <span className={css.passPill}>
            {stats.pass}/{stats.total}
          </span>
        </div>
      ) : null}
      <div>
        <p className={css.metricKey}>Outdoor area</p>
        <p className={`${css.metricVal}${stats.outdoorOk ? ` ${css.ok}` : ""}`}>
          {stats.site.toFixed(2)} m²
        </p>
      </div>
      <div>
        <p className={css.metricKey}>Permeable · min 20%</p>
        <p className={`${css.metricVal}${stats.permeableOk ? ` ${css.ok}` : ` ${css.bad}`}`}>
          {Math.round(stats.permeablePct)}%
        </p>
        <div className={css.bar}>
          <div className={css.barFill} style={{ width: `${stats.permeablePct}%` }} />
          <div className={css.barTick} style={{ left: "20%" }} />
        </div>
      </div>
      <div>
        <p className={css.metricKey}>Canopy @ maturity · 15%</p>
        <p className={`${css.metricVal}${stats.canopyOk ? ` ${css.ok}` : ` ${css.bad}`}`}>
          {Math.round(stats.canopyPct)}%
        </p>
        <div className={css.bar}>
          <div
            className={css.barFill}
            style={{ width: `${stats.canopyPct}%`, background: CSS_TOKEN.warning }}
          />
          <div className={css.barTick} style={{ left: "15%" }} />
        </div>
      </div>
    </aside>
  );
}
