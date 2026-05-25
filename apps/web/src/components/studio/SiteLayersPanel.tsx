"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  assessPlanningFromSketch,
  isTier1WrightsTerrace,
  TIER1_WRIGHTS_SAVINGS,
  WIKIMEDIA_TREE_ATTRIBUTION,
} from "@workstream/domain";
import type { PlanningFlag } from "@workstream/domain";
import type { CatalogPlacement, CatalogSymbol, DesignCanvas } from "@workstream/contracts";
import type { Survey } from "@workstream/contracts";
import sl from "./siteLayersPanel.module.css";

export type SiteLayerId =
  | "trp"
  | "sun-shade"
  | "easements"
  | "utilities"
  | "permits";

export type SiteLayerState = Record<SiteLayerId, { on: boolean; opacity: number }>;

type Props = {
  projectId: string;
  projectAddress: string;
  survey: Pick<Survey, "garden_area_m2" | "lot_area_m2" | "house_area_m2">;
  placements: CatalogPlacement[];
  symbols: CatalogSymbol[];
  layers: SiteLayerState;
  onToggle: (id: SiteLayerId) => void;
  onOpacity: (id: SiteLayerId, opacity: number) => void;
  conflictCount: number;
};

const LAYER_ROWS: { id: SiteLayerId; label: string; swatch: string }[] = [
  { id: "trp", label: "TRP zones", swatch: "var(--overlay-trp)" },
  { id: "sun-shade", label: "Sun/shade", swatch: "var(--overlay-shade)" },
  { id: "easements", label: "Easements", swatch: "var(--overlay-easement)" },
  { id: "utilities", label: "Utilities", swatch: "var(--overlay-utility)" },
];

function flagClass(flag: PlanningFlag): string {
  if (flag.severity === "likely") return sl.chipLikely;
  if (flag.severity === "review") return sl.chipReview;
  return sl.chipClear;
}

export function SiteLayersPanel({
  projectId,
  projectAddress,
  survey,
  placements,
  symbols,
  layers,
  onToggle,
  onOpacity,
  conflictCount,
}: Props) {
  const flags = useMemo(
    () =>
      assessPlanningFromSketch(
        projectAddress,
        survey,
        {
          id: "studio-live",
          project_id: projectId,
          placements,
          strokes: [],
          irrigation_zones: [],
          updated_at: new Date().toISOString(),
        } satisfies DesignCanvas,
        symbols,
      ),
    [projectAddress, survey, placements, symbols],
  );

  const tier1 = isTier1WrightsTerrace(projectAddress);
  const showDbyd = layers.utilities.on;

  return (
    <div className={sl.panel} data-testid="site-layers-panel">
      {LAYER_ROWS.map((row) => {
        const state = layers[row.id];
        return (
          <div key={row.id} className={sl.layerRow}>
            <button
              type="button"
              className={sl.eye}
              aria-label={state.on ? "Hide layer" : "Show layer"}
              onClick={() => onToggle(row.id)}
            >
              {state.on ? "◉" : "◌"}
            </button>
            <span className={sl.swatch} style={{ background: row.swatch }} />
            <span className={sl.name}>{row.label}</span>
            <span className={state.on ? sl.on : sl.off}>{state.on ? "on" : "off"}</span>
            {state.on ? (
              <input
                type="range"
                min={0}
                max={100}
                value={state.opacity}
                className={sl.slider}
                onChange={(e) => onOpacity(row.id, Number(e.target.value))}
                aria-label={`${row.label} opacity`}
              />
            ) : null}
          </div>
        );
      })}

      <p className={sl.section}>live permit flags — updated as you design</p>
      <div className={sl.chips}>
        {flags.slice(0, 6).map((f) => (
          <span key={f.id} className={`${sl.chip} ${flagClass(f)}`}>
            {f.title} · {f.severity}
          </span>
        ))}
      </div>
      <p className={sl.summary}>
        {flags.filter((f) => f.severity === "likely").length} likely permits ·{" "}
        {flags.filter((f) => f.severity === "review").length} review — indicative
      </p>

      {conflictCount > 0 ? (
        <p className={sl.conflict}>{conflictCount} conflicts — indicative</p>
      ) : (
        <p className={sl.summary}>no conflicts detected — indicative</p>
      )}

      {tier1 ? (
        <div className={sl.tier1}>
          <p>
            Tier-1 savings net {TIER1_WRIGHTS_SAVINGS.net_inc_gst.toFixed(0)} inc GST
          </p>
          <Link href={`/projects/${projectId}/design/develop`}>→ Full develop analysis</Link>
        </div>
      ) : null}

      {showDbyd ? (
        <div className={sl.dbyd}>
          <p>Before any dig: order a free DBYD (Dial Before You Dig) locate</p>
          <a href="https://www.1100.com.au" target="_blank" rel="noopener noreferrer">
            1100.com.au
          </a>
        </div>
      ) : null}

      <p className={sl.footer}>
        Indicative — confirm on site / title / locate
      </p>
      <p className={sl.attribution}>{WIKIMEDIA_TREE_ATTRIBUTION.slice(0, 48)}…</p>
    </div>
  );
}
