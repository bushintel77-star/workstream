"use client";

import {
  STUDIO_ARTBOARDS,
  type ArtboardId,
} from "@workstream/domain";
import css from "./artboardStrip.module.css";

type Props = {
  active: ArtboardId;
  onSelect: (id: ArtboardId) => void;
};

/**
 * Session artboard strip — Plan / Fit / Elev N·E·S·W.
 *
 * Renders *in flow* inside the top-edge `FrameDrawer`, which already portals to
 * the gallery frame through `CameraChrome place="frame"`. Do not wrap this in
 * its own `CameraChrome`: a second portal escapes the drawer and drops the strip
 * onto the drawing, where it swallows clicks on the geometry underneath
 * (elevation callouts — see e2e/elevation-callout-hit.spec.ts).
 */
export function ArtboardStrip({ active, onSelect }: Props) {
  return (
    <div
      className={css.strip}
      role="group"
      aria-label="Artboards"
      data-testid="artboard-strip"
      data-active={active}
    >
      <span className={css.kicker}>Sheets</span>
      {STUDIO_ARTBOARDS.map((board) => {
        const on = active === board.id;
        return (
          <button
            key={board.id}
            type="button"
            className={`${css.chip}${on ? ` ${css.chipOn}` : ""}`}
            data-testid={`artboard-${board.id}`}
            data-armed={on ? "1" : "0"}
            aria-pressed={on}
            title={board.label}
            onClick={() => onSelect(board.id)}
          >
            {board.chip}
          </button>
        );
      })}
    </div>
  );
}
