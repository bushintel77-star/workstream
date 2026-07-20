"use client";

import type { CSSProperties } from "react";
import { PAINT_SWATCHES, type StudioItemType } from "../../studioCatalog";
import css from "./swatchTray.module.css";

type Props = {
  /** Active fill swatch (drives Paint bucket). */
  activeSwatch: StudioItemType;
  /** Paint tool armed — only then is a swatch "pressed in". */
  armed: boolean;
  /** Eyedropper armed — next canvas click loads a style into the swatch. */
  eyedropOn: boolean;
  /** Select swatch → arms Paint. Then click a target on canvas to apply. */
  onPick: (t: StudioItemType) => void;
  /** Toggle the eyedropper (pick style off any element). */
  onEyedrop: () => void;
  /** Preview a swatch on hover/hold (ghost intent before commit). */
  onPreview?: (t: StudioItemType | null) => void;
};

/**
 * Swatch-and-apply tray — persistent furniture, not a popup.
 *
 * Neumorphic base layer (pressed from the blush field): sits in the left
 * gutter, always visible in plan modes, clearly a different visual layer than
 * the glassmorphic transient panels that float above it. Direct manipulation:
 * pick a swatch (pressed-in inset state) → click a shape on the canvas → the
 * target settles into its new value. No modal, no confirm.
 */
export function SwatchTray({
  activeSwatch,
  armed,
  eyedropOn,
  onPick,
  onEyedrop,
  onPreview,
}: Props) {
  return (
    <aside
      className={css.tray}
      data-testid="swatch-tray"
      aria-label="Material swatches"
    >
      <p className={css.kicker} aria-hidden>
        Fill
      </p>
      <div className={css.stack} role="listbox" aria-label="Fill swatches">
        {PAINT_SWATCHES.map((sw) => {
          const on = armed && sw.t === activeSwatch;
          return (
            <button
              key={sw.t}
              type="button"
              role="option"
              aria-selected={on}
              className={`${css.swatch}${on ? ` ${css.swatchOn}` : ""}`}
              data-testid={`swatch-${sw.t}`}
              title={`${sw.label} — click, then click a shape to fill`}
              style={{ ["--wash" as string]: sw.wash } as CSSProperties}
              onClick={() => onPick(sw.t)}
              onPointerEnter={() => onPreview?.(sw.t)}
              onPointerLeave={() => onPreview?.(null)}
              onBlur={() => onPreview?.(null)}
            >
              <span className={css.chip} aria-hidden />
              <span className={css.label}>{sw.label}</span>
            </button>
          );
        })}
      </div>

      <div className={css.divider} aria-hidden />

      <button
        type="button"
        className={`${css.swatch}${css.tool ? ` ${css.tool}` : ""}${eyedropOn ? ` ${css.swatchOn}` : ""}`}
        data-testid="swatch-eyedrop"
        aria-pressed={eyedropOn}
        title="Eyedropper — click any element to load its style"
        onClick={onEyedrop}
      >
        <span className={css.toolGlyph} aria-hidden>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
            <path
              d="M10.5 2.5a1.6 1.6 0 0 1 2.3 2.3l-1 1 .8.8-1.1 1.1-.8-.8-4.5 4.5-2.4.7.7-2.4 4.5-4.5-.8-.8L9.3 3.3l.4-.4z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={css.label}>Pick</span>
      </button>
    </aside>
  );
}
