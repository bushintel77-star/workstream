"use client";

import { useMemo, useState } from "react";
import {
  computeLiveConfidenceFactors,
  growthFactorFromStage,
  sunShadowVector,
  type ConfidenceFactor,
  type LiveGhostScene,
  type LiveGhostSubject,
  type LiveGhostTree,
} from "@workstream/domain";
import { BY_TYPE, itemCost, type StudioItem } from "../../studioCatalog";
import { tpzRadiusPct, type PctPoint } from "../../geometry";
import styles from "./aiGhosts.module.css";

type Props = {
  ghosts: StudioItem[];
  /** Accepted + ghost items for TPZ / shade context. */
  items: StudioItem[];
  boundary: PctPoint[];
  building: PctPoint[];
  scaleM: number;
  sunMin: number;
  growth: "plant" | "5yr" | "mature";
  selectedId: string | null;
  factorsOpen: boolean;
  onFactorsOpen: (open: boolean) => void;
  onSelect: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCycle: (dir?: 1 | -1) => void;
  onAskAi: (id: string) => void;
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

function Factors({ factors }: { factors: ConfidenceFactor[] }) {
  return (
    <ul className={styles.factors}>
      {factors.map((f) => (
        <li key={f.label} className={styles.factorRow}>
          <div className={styles.factorMeta}>
            <span>{f.label}</span>
            <span className={styles.factorPct}>{f.pct}%</span>
          </div>
          <div className={styles.factorBar}>
            <div className={styles.factorFill} style={{ width: `${f.pct}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function peerRatesFor(typeId: StudioItem["t"]): number[] {
  const def = BY_TYPE[typeId];
  return Object.values(BY_TYPE)
    .filter(
      (o) =>
        !o.existing &&
        !!o.area === !!def.area &&
        !!o.lin === !!def.lin,
    )
    .map((o) => o.rate)
    .filter((r) => r > 0);
}

function toTree(it: StudioItem, scaleM: number): LiveGhostTree | null {
  const d = BY_TYPE[it.t];
  if (!d.canopyM && !d.existing) return null;
  const dbhM = d.dbhM ?? 0.45;
  const { rxPct } = d.existing
    ? tpzRadiusPct(dbhM, scaleM)
    : {
        rxPct: ((Math.max(2, 12 * dbhM) * (it.scale || 1)) / scaleM) * 100,
      };
  return {
    x: it.x,
    y: it.y,
    tpzRadiusPct: rxPct,
    canopyM: d.canopyM ?? 4,
    heightM: d.heightM ?? 4,
    scale: it.scale || 1,
    existing: Boolean(d.existing),
  };
}

function buildSubject(g: StudioItem): LiveGhostSubject {
  const d = BY_TYPE[g.t];
  return {
    typeId: g.t,
    x: g.x,
    y: g.y,
    scale: g.scale,
    rate: d.rate,
    canopyM: d.canopyM,
    heightM: d.heightM,
    peerRates: peerRatesFor(g.t),
    isHedge: g.t === "hedge",
    isFrenchDrain: g.t === "frenchdrain",
    seedConf: g.conf,
  };
}

/**
 * AI ghost review — confidence bar expands to live factor breakdown
 * (sun / TPZ / cost; drainage neutral until services exist).
 */
export function AiGhostReview({
  ghosts,
  items,
  boundary,
  building,
  scaleM,
  sunMin,
  growth,
  selectedId,
  factorsOpen,
  onFactorsOpen,
  onSelect,
  onAccept,
  onReject,
  onCycle,
  onAskAi,
}: Props) {
  const [localOpen, setLocalOpen] = useState(factorsOpen);

  const scene: LiveGhostScene = useMemo(() => {
    const trees: LiveGhostTree[] = [];
    const shadeCasters: LiveGhostTree[] = [];
    for (const it of items) {
      if (it.ghost) continue;
      const tr = toTree(it, scaleM);
      if (!tr) continue;
      if (tr.existing) trees.push(tr);
      else if (BY_TYPE[it.t].canopyM) shadeCasters.push(tr);
    }
    const cx =
      building.length >= 3
        ? building.reduce((s, p) => s + p.x, 0) / building.length
        : 50;
    const cy =
      building.length >= 3
        ? building.reduce((s, p) => s + p.y, 0) / building.length
        : 50;
    return {
      trees,
      shadeCasters,
      buildingCentroid: { x: cx, y: cy },
      scaleM,
      shadow: sunShadowVector(sunMin),
      growthFactor: growthFactorFromStage(growth),
    };
  }, [items, building, scaleM, sunMin, growth]);

  if (ghosts.length === 0) {
    return (
      <div className={styles.empty} data-testid="ai-ghost-empty">
        <p className={styles.emptyTitle}>No pending ghosts</p>
        <p className={styles.emptyBody}>
          Use Ask AI or Cmd+K to Scan — proposals land here as ghosts until you
          accept them (A / Enter) onto the working drawing.
        </p>
      </div>
    );
  }

  const selected = ghosts.find((g) => g.id === selectedId) ?? ghosts[0]!;
  const def = BY_TYPE[selected.t];
  const live = computeLiveConfidenceFactors(buildSubject(selected), scene, {
    boundary,
  });
  const pct = Math.round(live.overall * 100);
  const factors = live.factors;
  const isStale = Boolean(selected.stale);
  const expanded = localOpen;
  const cost = itemCost({ ...selected, ghost: false });

  const toggleFactors = () => {
    const next = !expanded;
    setLocalOpen(next);
    onFactorsOpen(next);
  };

  return (
    <div className={styles.root} data-testid="cad-ghost-review">
      <div className={styles.list}>
        {ghosts.map((g) => {
          const d = BY_TYPE[g.t];
          const stale = Boolean(g.stale);
          const rowLive = computeLiveConfidenceFactors(buildSubject(g), scene, {
            boundary,
          });
          return (
            <button
              key={g.id}
              type="button"
              className={styles.row}
              data-active={g.id === selected.id ? "true" : "false"}
              data-stale={stale ? "true" : "false"}
              onClick={() => onSelect(g.id)}
            >
              <span className={styles.rowTitle}>{d.name}</span>
              <span className={styles.rowMeta}>
                {Math.round(rowLive.overall * 100)}%
                {stale ? " · stale" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.detail}>
        <div className={styles.detailHead}>
          <h3 className={styles.detailTitle}>{def.name}</h3>
          {isStale ? (
            <span className={styles.badge} data-stale="true">
              Stale — re-check site
            </span>
          ) : null}
        </div>
        <p className={styles.reason}>{selected.why ?? "AI layout proposal"}</p>
        {live.notes.length > 0 ? (
          <p className={styles.impact} data-testid="ghost-live-notes">
            {live.notes.join(" · ")}
          </p>
        ) : null}
        {cost > 0 ? (
          <p className={styles.impact}>If accepted: +{aud(cost)}</p>
        ) : null}

        <button
          type="button"
          className={styles.confBtn}
          title="Show confidence factors"
          onClick={toggleFactors}
          data-testid="ghost-confidence-toggle"
        >
          <span className={styles.confLabel}>
            Confidence {pct}%
            {live.liveDrift ? (
              <span data-testid="ghost-live-drift" title="Live score drifted from seed">
                {" "}
                · live
              </span>
            ) : null}{" "}
            <span aria-hidden>{expanded ? "▴" : "▾"}</span>
          </span>
          <span className={styles.confTrack}>
            <span
              className={styles.confFill}
              style={{
                width: `${pct}%`,
                background: "#1C1917",
              }}
            />
          </span>
        </button>

        {expanded ? <Factors factors={factors} /> : null}

        <div className={styles.actions}>
          <button type="button" className={styles.accept} onClick={() => onAccept(selected.id)}>
            Accept (A / Enter)
          </button>
          <button type="button" className={styles.reject} onClick={() => onReject(selected.id)}>
            Reject (R)
          </button>
          <button type="button" className={styles.ask} onClick={() => onAskAi(selected.id)}>
            Ask AI
          </button>
          <button type="button" className={styles.ask} onClick={() => onCycle(-1)}>
            Prev
          </button>
          <button type="button" className={styles.ask} onClick={() => onCycle(1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
