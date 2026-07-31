"use client";

import type { ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import css from "./marginStrip.module.css";

/**
 * The margin — surface 3 of 4 (see docs/STUDIO-SURFACES.md).
 *
 * ONE quiet strip along the bottom of the board that owns everything that
 * used to float there separately: undo/redo, the pan/edit state, the mode
 * hint line, the honesty disclaimer, and (in Fit) the print scale. Nothing
 * in the margin ever overlaps a ruler label — the strip reserves the ruler
 * gutter via --ws-safe-bottom and sits above it.
 *
 * Slots, left → right:
 *   history  — undo/redo chips (studio passes its own wired buttons)
 *   state    — transient state pill (pan armed, edit mode…), may be null
 *   actions  — mode commit chips (Tidy / Formalize in Sketch), may be null
 *   hint     — one-line mode hint, muted; may be null
 *   spacer
 *   stamp    — scale / revision stamp (Fit contexts); may be null
 *   legal    — the honesty caption (always last, never wraps over rulers)
 *
 * Mounted through CameraChrome dock placement: this is chrome, never a
 * child of zoom-world (gate C). Seats on the same bottom-left shelf ladder
 * (board-relative equivalent of --ws-stack-2) as the sketch tray / phase
 * chip / artboard strip so it never collides with them.
 */
export function MarginStrip({
  history,
  state,
  actions,
  hint,
  stamp,
  legal,
  dark = false,
}: {
  history?: ReactNode;
  state?: ReactNode;
  actions?: ReactNode;
  hint?: ReactNode;
  stamp?: ReactNode;
  legal?: ReactNode;
  /** Night board (pass the studio's darkLens — never raw ui.darkOn). */
  dark?: boolean;
}) {
  if (!history && !state && !actions && !hint && !stamp && !legal) return null;
  return (
    <CameraChrome testId="margin-strip">
      <div
        className={`${css.strip}${dark ? ` ${css.stripDark}` : ""}`}
        data-frame-rail="bottom"
        role="contentinfo"
        aria-label="Board margin"
        data-testid="margin-strip-body"
      >
        {history ? <div className={css.history}>{history}</div> : null}
        {state ? <div className={css.state}>{state}</div> : null}
        {actions ? <div className={css.actions}>{actions}</div> : null}
        {hint ? <div className={css.hint}>{hint}</div> : null}
        <div className={css.spacer} aria-hidden />
        {stamp ? <div className={css.stamp}>{stamp}</div> : null}
        {legal ? <p className={css.legal}>{legal}</p> : null}
      </div>
    </CameraChrome>
  );
}
