"use client";

import {
  CSS_TOKEN,
  mixOnCanvas,
} from "../../../../../styles/colorTokens";
import css from "./metaIcon.module.css";

export type MetaIconId = "site" | "services" | "trees";

type Props = {
  id: MetaIconId;
  size?: number;
  /** Accessible label override. */
  label?: string;
};

const LABELS: Record<MetaIconId, string> = {
  site: "Site boundary",
  services: "Services",
  trees: "Existing trees",
};

/**
 * Compact boundary-rail glyphs — lot/parcel, service run, tree canopy.
 * Static SVG (no emoji); blush accent ink via currentColor + accent stroke.
 */
export function MetaIcon({ id, size = 18, label }: Props) {
  const aria = label ?? LABELS[id];
  const s = size;
  return (
    <span
      className={css.root}
      data-testid={`meta-icon-${id}`}
      data-meta-icon={id}
      style={{ width: s, height: s }}
      role="img"
      aria-label={aria}
      title={aria}
    >
      {id === "site" ? (
        <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden>
          <path
            d="M6 8 L20 6 L26 11 L25 25 L9 26 L6 8 Z"
            fill={mixOnCanvas(CSS_TOKEN.existingStroke, 10)}
            stroke={CSS_TOKEN.existingStroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <rect
            x="13"
            y="14"
            width="8"
            height="7"
            fill="none"
            stroke={CSS_TOKEN.textMuted}
            strokeWidth="1.4"
          />
        </svg>
      ) : null}
      {id === "services" ? (
        <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden>
          <path
            d="M4 12 Q9 6 14 12 T24 12 M4 20 Q9 14 14 20 T24 20"
            fill="none"
            stroke={CSS_TOKEN.existingStroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="27" cy="12" r="2" fill={CSS_TOKEN.textMuted} />
          <circle cx="27" cy="20" r="2" fill={CSS_TOKEN.textMuted} />
        </svg>
      ) : null}
      {id === "trees" ? (
        <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden>
          <path
            d="M16 25 L16 19"
            stroke={CSS_TOKEN.textMuted}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M16 6 C11 6 8 10 9.5 14 C6.5 15.5 7.5 20 12 20 L20 20 C24.5 20 25.5 15.5 22.5 14 C24 10 21 6 16 6 Z"
            fill={mixOnCanvas(CSS_TOKEN.plantingRetainStroke, 16)}
            stroke={CSS_TOKEN.plantingRetainStroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}
