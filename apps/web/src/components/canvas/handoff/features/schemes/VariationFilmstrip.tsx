"use client";

import type { DesignSchemeSnapshot, Pt } from "../../studioCatalog";
import { SchemePlanThumb } from "./SchemePlanThumb";
import css from "./variationFilmstrip.module.css";

type Props = {
  schemes: DesignSchemeSnapshot[];
  activeSchemeId: string | null;
  boundary: Pt[];
  building: Pt[];
  onSave: () => void;
  onActivate: (id: string) => void;
};

/**
 * A/B/C scheme thumbs under one title boundary — client meeting surface.
 * Session-first; site_frame (boundary/building/levels) is shared.
 *
 * Renders *in flow* inside the bottom-edge `FrameDrawer`, which already portals
 * to the gallery frame. Do not wrap this in its own `CameraChrome`: a second
 * portal escapes the drawer and drops the strip onto the drawing with whatever
 * absolute offset its CSS still carries — the same double portal that parked
 * the Sheets strip mid-plan (see `ArtboardStrip`, `7a3b7ed`).
 */
export function VariationFilmstrip({
  schemes,
  activeSchemeId,
  boundary,
  building,
  onSave,
  onActivate,
}: Props) {
  return (
    <div className={css.strip} data-testid="variation-filmstrip">
      <p className={css.kicker}>Schemes</p>
      <div className={css.thumbs}>
        {schemes.map((s) => (
          <button
            key={s.id}
            type="button"
            className={css.thumb}
            data-active={activeSchemeId === s.id ? "true" : "false"}
            data-testid={`scheme-thumb-${s.letter}`}
            onClick={() => onActivate(s.id)}
          >
            <SchemePlanThumb
              scheme={s}
              boundary={boundary}
              building={building}
            />
            <span className={css.letter}>{s.letter}</span>
          </button>
        ))}
        {schemes.length < 3 ? (
          <button
            type="button"
            className={css.save}
            data-testid="scheme-save"
            onClick={onSave}
          >
            Save as {schemes.length === 0 ? "A" : schemes.length === 1 ? "B" : "C"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
