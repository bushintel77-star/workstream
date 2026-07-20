"use client";

import type { CSSProperties } from "react";
import { PAINT_SWATCHES, type StudioItemType } from "../../studioCatalog";
import css from "./swatchTray.module.css";

type Props = {
  /** Active fill swatch (drives Paint bucket). */
  activeSwatch: StudioItemType;
  /** Paint tool armed — only then is a swatch "pressed in". */
  armed: boolean;
  /** Select swatch → arms Paint. Then click a target on canvas to apply. */
  onPick: (t: StudioItemType) => void;
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
export function SwatchTray({ activeSwatch, armed, onPick, onPreview }: Props) {
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
    </aside>
  );
}
