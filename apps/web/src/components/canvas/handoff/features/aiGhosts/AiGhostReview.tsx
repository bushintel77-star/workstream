"use client";

import {
  deriveConfidenceFactors,
  ghostCategoryFromSymbol,
  type ConfidenceFactor,
} from "@workstream/domain";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import styles from "./aiGhosts.module.css";

type Props = {
  ghosts: StudioItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCycle: () => void;
  onAskAi: (id: string) => void;
};

function factorState(pct: number): "pass" | "warn" | "fail" {
  if (pct >= 75) return "pass";
  if (pct >= 50) return "warn";
  return "fail";
}

function Factors({ factors }: { factors: ConfidenceFactor[] }) {
  return (
    <ul className={styles.factors}>
      {factors.map((f) => (
        <li key={f.label} className={styles.factor} data-state={factorState(f.pct)}>
          <span className={styles.factorDot} aria-hidden />
          <span>
            {f.label} · {f.pct}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * AI ghost review — list + confidence factors + accept/reject/Ask AI.
 * Ghosts stay ephemeral until Accept; stale flags come from nearby edits.
 */
export function AiGhostReview({
  ghosts,
  selectedId,
  onSelect,
  onAccept,
  onReject,
  onCycle,
  onAskAi,
}: Props) {
  if (ghosts.length === 0) {
    return (
      <div className={styles.empty} data-testid="ai-ghost-empty">
        <p className={styles.emptyTitle}>No pending ghosts</p>
        <p className={styles.emptyBody}>
          Run Scan for AI ghosts from the ribbon, or ask AI to propose layout moves.
          Accepted ghosts become live drawing objects.
        </p>
      </div>
    );
  }

  const selected = ghosts.find((g) => g.id === selectedId) ?? ghosts[0]!;
  const def = BY_TYPE[selected.t];
  const category = ghostCategoryFromSymbol(selected.t, def.name);
  const confidence = selected.conf ?? 0.8;
  const factors = deriveConfidenceFactors(selected.id, confidence, category);
  const isStale = Boolean(selected.stale);

  return (
    <div className={styles.root} data-testid="cad-ghost-review">
      <div className={styles.list}>
        {ghosts.map((g) => {
          const d = BY_TYPE[g.t];
          const cat = ghostCategoryFromSymbol(g.t, d.name);
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
                {Math.round((g.conf ?? 0.8) * 100)}% · {cat}
                {stale ? " · stale" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.detail}>
        <div className={styles.detailHead}>
          <h3 className={styles.detailTitle}>{def.name}</h3>
          <span className={styles.badge} data-stale={isStale ? "true" : "false"}>
            {isStale
              ? "Stale — re-check site"
              : `${Math.round(confidence * 100)}% confidence`}
          </span>
        </div>
        <p className={styles.reason}>{selected.why ?? "AI layout proposal"}</p>
        <Factors factors={factors} />
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
          <button type="button" className={styles.ask} onClick={onCycle}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
