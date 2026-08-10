"use client";

import { CameraChrome } from "../../CameraChrome";
import { playInstrumentTick } from "../ambient/instrumentTick";
import {
  POINTER_MARKS,
  type PointerMarkId,
} from "./pointerMarks";
import css from "./pointerMarkSettings.module.css";

type Props = {
  open: boolean;
  markId: PointerMarkId;
  /** Hover-to-skim — live cursor preview; null clears. */
  onPreview: (id: PointerMarkId | null) => void;
  /** Click-to-keep — persists. */
  onMarkId: (id: PointerMarkId) => void;
  onClose: () => void;
};

/**
 * Settings sheet for the drawing cursor mark.
 * Structure borrows “skim then commit”; surface is calm CAD preferences.
 *
 * Frosted chrome anchored to the viewport safe area, so it portals through
 * `CameraChrome place={{ kind: "frame" }}` (gate B) rather than sitting inside
 * `.zoomWorld` where it would scale and pan with the camera. Summoned from
 * Cmd+K per STUDIO-STYLING-AND-UX.md §6 item 9 — no new top-ribbon button.
 */
export function PointerMarkSettings({
  open,
  markId,
  onPreview,
  onMarkId,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <CameraChrome
      place={{ kind: "frame" }}
      testId="pointer-mark-settings-chrome"
    >
      <aside
        className={css.panel}
        data-testid="pointer-mark-settings"
        aria-label="Pointer settings"
      >
        <header className={css.head}>
          <p className={css.kicker}>Settings</p>
          <button
            type="button"
            className={css.close}
            aria-label="Close settings"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <p className={css.title}>Pointer mark</p>
        <p className={css.hint}>
          Idle craft mark for drafting. The pointer still changes by tool —
          measure, paint, place, pan, and lock each swap function. Hover to
          preview, click to keep.
        </p>
        <div
          className={css.row}
          role="listbox"
          aria-label="Pointer marks"
          onMouseLeave={() => onPreview(null)}
        >
          {POINTER_MARKS.map((m) => {
            const on = m.id === markId;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={on}
                className={`${css.mark}${on ? ` ${css.markOn}` : ""}`}
                data-testid={`pointer-mark-${m.id}`}
                title={m.label}
                onMouseEnter={() => onPreview(m.id)}
                onFocus={() => onPreview(m.id)}
                onBlur={() => onPreview(null)}
                onClick={() => {
                  playInstrumentTick("arm");
                  onMarkId(m.id);
                }}
              >
                <span className={css.glyph} aria-hidden>
                  {m.glyph}
                </span>
                <span className={css.label}>{m.label}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </CameraChrome>
  );
}
