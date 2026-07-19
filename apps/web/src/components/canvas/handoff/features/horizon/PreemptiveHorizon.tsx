"use client";

import type { StudioHorizonCard } from "@workstream/domain";
import css from "./preemptiveHorizon.module.css";

type Props = {
  cards: StudioHorizonCard[];
  onAccept: (card: StudioHorizonCard) => void;
  onDismiss: (id: string) => void;
};

const KIND_LABEL: Record<StudioHorizonCard["kind"], string> = {
  drainage: "A thought on drainage",
  tpz: "Tree protection",
  engineer: "Before you go further",
  spoil: "Site access",
  assembly: "Under the surface",
};

/**
 * Conversational foresight cards — Accept / Dismiss only (Canvas-First HITL).
 */
export function PreemptiveHorizon({ cards, onAccept, onDismiss }: Props) {
  if (cards.length === 0) return null;

  return (
    <div className={css.stack} data-testid="preemptive-horizon">
      {cards.slice(0, 2).map((card) => (
        <article
          key={card.id}
          className={`${css.card} ${css[card.severity]}`}
          data-kind={card.kind}
        >
          <p className={css.kicker}>{KIND_LABEL[card.kind]}</p>
          <p className={css.title}>{card.title.replace(/foreshadowed/gi, "").trim()}</p>
          <p className={css.detail}>{card.detail}</p>
          <div className={css.actions}>
            {card.suggestType ? (
              <button
                type="button"
                className={css.accept}
                onClick={() => onAccept(card)}
              >
                Yes, add it
              </button>
            ) : null}
            <button
              type="button"
              className={css.dismiss}
              onClick={() => onDismiss(card.id)}
            >
              Not now
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
