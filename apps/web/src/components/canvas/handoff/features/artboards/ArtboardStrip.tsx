"use client";

import {
  STUDIO_ARTBOARDS,
  type ArtboardId,
} from "@workstream/domain";
import { CameraChrome } from "../../CameraChrome";
import css from "./artboardStrip.module.css";

type Props = {
  active: ArtboardId;
  onSelect: (id: ArtboardId) => void;
};

/**
 * Session artboard strip — Plan / Fit / Elev N·E·S·W.
 * CameraChrome dock only (never under zoom-world). Borderless until active.
 */
export function ArtboardStrip({ active, onSelect }: Props) {
  return (
    <CameraChrome place={{ kind: "dock" }} zIndex={41} testId="artboard-strip-chrome">
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
    </CameraChrome>
  );
}
