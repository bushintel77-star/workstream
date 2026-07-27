"use client";

import type { BoardFinding } from "@workstream/contracts";
import css from "./boardFindings.module.css";

type Props = {
  findings: BoardFinding[];
  onDismiss: (id: string) => void;
};

const KIND_LABEL: Record<BoardFinding["kind"], string> = {
  canopy_conflict: "Canopy at maturity",
  dig_conflict: "Before you dig",
  permeability: "Permeability",
  quote_mismatch: "Design vs quote",
  sheet_gap: "Deliverable set",
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
 */
export function BoardFindings({
  findings,
  onDismiss,
  embedded = false,
}: Props & { embedded?: boolean }) {
  if (findings.length === 0) return null;

  return (
    <section
      className={embedded ? css.embedded : css.stack}
      data-testid="board-findings"
      aria-live="polite"
    >
      {findings.slice(0, 4).map((f) => (
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
            <span className={css.citeLabel}>Reasoned over</span> {f.cites.join(", ")}
            {" · "}
            <span className={css.basis} data-basis={f.basis}>
              {BASIS_LABEL[f.basis]}
            </span>
          </p>
          <div className={css.actions}>
            <button
              type="button"
              className={css.dismiss}
              onClick={() => onDismiss(f.id)}
            >
              Not now
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
