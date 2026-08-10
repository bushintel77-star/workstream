"use client";

import type { StudioHorizonCard } from "@workstream/domain";
import css from "./preemptiveHorizon.module.css";

type Props = {
  cards: StudioHorizonCard[];
  onFocus: (card: StudioHorizonCard) => void;
};

/**
 * Canvas overlay pins for open horizon cards — foreshadow mitigation before accept.
 * Each pin is a real button with an accessible name, a 44px hit area (14px visual),
 * and a pulse that settles after 3 cycles so it draws attention without becoming
 * permanent visual noise.
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
    <div className={css.markers} data-testid="horizon-markers">
      {pinned.map((card) => {
        const severityLabel =
          card.severity === "critical"
            ? "Critical risk"
            : card.severity === "watch"
              ? "Watch"
              : "Info";
        return (
          <button
            key={card.id}
            type="button"
            className={`${css.pin} ${css[`pin_${card.severity}`]}`}
            style={{ left: `${card.x}%`, top: `${card.y}%` }}
            aria-label={`${severityLabel}: ${card.title}`}
            title={card.title}
            onClick={() => onFocus(card)}
          />
        );
      })}
    </div>
  );
}
