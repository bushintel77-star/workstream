"use client";

import css from "./headerAiPill.module.css";

type Props = {
  label: string;
  /** Pending ghosts / scanning / assisting */
  hot?: boolean;
  /** Verified — quiet idle */
  ok?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

/**
 * Primary header AI control — scan, review ghosts, or open Cmd+K assist.
 * CAD-style command strip; keeps the intern off the drawing plane.
 */
export function HeaderAiPill({
  label,
  hot = false,
  ok = false,
  disabled = false,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      className={`${css.pill}${hot ? ` ${css.pillHot}` : ""}${ok ? ` ${css.pillOk}` : ""}`}
      data-testid="header-accept-ghosts"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
