"use client";

import type { BoardFinding } from "@workstream/contracts";
import css from "./boardFindings.module.css";

type Props = {
  findings: BoardFinding[];
  /** Blocks the board cannot reason about — surfaced, never papered over. */
  gaps?: string[];
  onDismiss: (id: string) => void;
  /** Recentre the camera on a finding that carries board coords. */
  onShow?: (finding: BoardFinding) => void;
  embedded?: boolean;
};

const KIND_LABEL: Record<BoardFinding["kind"], string> = {
  canopy_conflict: "Canopy at maturity",
  dig_conflict: "Before you dig",
  permeability: "Permeability",
  quote_mismatch: "Design vs quote",
  sheet_gap: "Deliverable set",
  site_compliance: "Site compliance",
  overlay_watch: "Overlay watch",
};

/** How strong the evidence is — the operator reads this before trusting it. */
const BASIS_LABEL: Record<BoardFinding["basis"], string> = {
  vicmap: "Vicmap fact",
  operator: "your sketch",
  derived: "estimate",
  seed: "demo geometry",
  absent: "no data",
};

/**
 * Cross-artefact board findings — read-only, provenance-cited advisories.
 *
 * These reason across the whole board (planting × structures, trenches ×
 * services, surfaces × targets, design × quote). They warn; they never mutate,
 * and unlike a ghost there is no geometry to "accept" — the fix is the
 * operator's call. Every card cites the artefacts it reasoned over and how
 * strong that evidence is, so an estimate reads weaker than a survey fact. That
 * citation is the guard against taking the machine's word for it.
 *
 * Gaps are the honest counterpart: when a block is missing, the board says so
 * instead of inventing a verdict.
 */
export function BoardFindings({
  findings,
  gaps = [],
  onDismiss,
  onShow,
  embedded = false,
}: Props) {
  if (findings.length === 0 && gaps.length === 0) return null;

  return (
    <section
      className={embedded ? css.embedded : css.stack}
      data-testid="board-findings"
      aria-live="polite"
    >
      {gaps.length > 0 ? (
        <aside className={css.gaps} data-testid="board-findings-gaps">
          <p className={css.gapsKicker}>Board can&apos;t reason about</p>
          <ul className={css.gapsList}>
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </aside>
      ) : null}
      {findings.map((f) => {
        const showable =
          onShow != null && typeof f.x === "number" && typeof f.y === "number";
        return (
          <article
            key={f.id}
            className={`${css.card} ${css[f.severity]}`}
            data-kind={f.kind}
            data-basis={f.basis}
          >
            <p className={css.kicker}>{KIND_LABEL[f.kind]}</p>
            <p className={css.title}>{f.title}</p>
            <p className={css.detail}>{f.detail}</p>
            <p className={css.cite}>
              <span className={css.citeLabel}>Reasoned over</span>{" "}
              {f.cites.join(", ")}
              {" · "}
              <span className={css.basis} data-basis={f.basis}>
                {BASIS_LABEL[f.basis]}
              </span>
            </p>
            <div className={css.actions}>
              {showable ? (
                <button
                  type="button"
                  className={css.show}
                  onClick={() => onShow(f)}
                >
                  Show on board
                </button>
              ) : null}
              <button
                type="button"
                className={css.dismiss}
                onClick={() => onDismiss(f.id)}
              >
                Not now
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
