"use client";

import type { StudioHorizonCard } from "@workstream/domain";
import css from "./preemptiveHorizon.module.css";

type Props = {
  cards: StudioHorizonCard[];
  onAccept: (card: StudioHorizonCard) => void;
  onDismiss: (id: string) => void;
};

/**
 * Preemptive horizon — foreshadowed logistics / drainage / TPZ cards near focus.
 * Accept sketches the mitigation onto the drawing; no Design↔Quote toggle.
 */
export function PreemptiveHorizon({ cards, onAccept, onDismiss }: Props) {
  if (cards.length === 0) return null;

  return (
    <div className={css.stack} data-testid="preemptive-horizon">
      {cards.slice(0, 3).map((card) => (
        <article
          key={card.id}
          className={`${css.card} ${css[card.severity]}`}
          data-kind={card.kind}
        >
          <p className={css.kicker}>{card.kind}</p>
          <p className={css.title}>{card.title}</p>
          <p className={css.detail}>{card.detail}</p>
          <div className={css.actions}>
            {card.suggestType ? (
              <button
                type="button"
                className={css.accept}
                onClick={() => onAccept(card)}
              >
                Sketch mitigation
              </button>
            ) : null}
            <button
              type="button"
              className={css.dismiss}
              onClick={() => onDismiss(card.id)}
            >
              Dismiss
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
