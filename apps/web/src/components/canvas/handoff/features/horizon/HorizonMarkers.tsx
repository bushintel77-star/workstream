"use client";

import type { StudioHorizonCard } from "@workstream/domain";
import css from "./preemptiveHorizon.module.css";

type Props = {
  cards: StudioHorizonCard[];
  onFocus: (card: StudioHorizonCard) => void;
};

/**
 * Canvas overlay pins for open horizon cards — foreshadow mitigation before accept.
 */
export function HorizonMarkers({ cards, onFocus }: Props) {
  const pinned = cards.filter(
    (c) =>
      c.x != null &&
      c.y != null &&
      (c.kind === "drainage" || c.kind === "tpz" || c.kind === "engineer"),
  );
  if (pinned.length === 0) return null;

  return (
    <div className={css.markers} data-testid="horizon-markers" aria-hidden>
      {pinned.map((card) => (
        <button
          key={card.id}
          type="button"
          className={`${css.pin} ${css[`pin_${card.severity}`]}`}
          style={{ left: `${card.x}%`, top: `${card.y}%` }}
          title={card.title}
          onClick={() => onFocus(card)}
        />
      ))}
    </div>
  );
}
