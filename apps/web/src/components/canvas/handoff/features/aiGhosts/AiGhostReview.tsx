"use client";

import { useState } from "react";
import {
  deriveConfidenceFactors,
  ghostCategoryFromSymbol,
  type ConfidenceFactor,
} from "@workstream/domain";
import { BY_TYPE, itemCost, type StudioItem } from "../../studioCatalog";
import styles from "./aiGhosts.module.css";

type Props = {
  ghosts: StudioItem[];
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

/**
 * AI ghost review — confidence bar expands in-place to factor breakdown.
 */
export function AiGhostReview({
  ghosts,
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

  if (ghosts.length === 0) {
    return (
      <div className={styles.empty} data-testid="ai-ghost-empty">
        <p className={styles.emptyTitle}>No pending ghosts</p>
        <p className={styles.emptyBody}>
          Drop an aerial to scan for canopy, or Ask AI from the command palette.
          Accepted ghosts become live drawing objects.
        </p>
      </div>
    );
  }

  const selected = ghosts.find((g) => g.id === selectedId) ?? ghosts[0]!;
  const def = BY_TYPE[selected.t];
  const category = ghostCategoryFromSymbol(selected.t, def.name);
  const confidence = selected.conf ?? 0.8;
  const pct = Math.round(confidence * 100);
  const factors = deriveConfidenceFactors(selected.id, confidence, category);
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
                {Math.round((g.conf ?? 0.8) * 100)}%
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
            Confidence {pct}% <span aria-hidden>{expanded ? "▴" : "▾"}</span>
          </span>
          <span className={styles.confTrack}>
            <span
              className={styles.confFill}
              style={{
                width: `${pct}%`,
                background: pct >= 85 ? "#1F8A5A" : pct >= 70 ? "#E8B84B" : "#C2455F",
              }}
            />
          </span>
        </button>

        {expanded ? <Factors factors={factors} /> : null}

        <div className={styles.actions}>
          <button type="button" className={styles.accept} onClick={() => onAccept(selected.id)}>
            Accept (A)
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
