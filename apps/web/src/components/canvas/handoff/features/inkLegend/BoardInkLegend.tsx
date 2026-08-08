"use client";

import { CameraChrome } from "../../CameraChrome";
import kit from "../chromeKit/summonedDock.module.css";
import css from "./boardInkLegend.module.css";

const ROWS = [
  { key: "existing", label: "Existing", token: "var(--existing-stroke)" },
  { key: "proposed", label: "Proposed", token: "var(--proposed-stroke)" },
  {
    key: "planting",
    label: "Planting",
    token: "var(--planting-new-stroke)",
  },
  { key: "easement", label: "Easement", token: "var(--easement-stroke)" },
  { key: "byda-water", label: "BYDA water", token: "var(--apwa-water)" },
  { key: "byda-elec", label: "BYDA electric", token: "var(--apwa-electric)" },
] as const;

type Props = {
  onClose: () => void;
};

/**
 * Board ink legend — summoned frost dock (never painted on the plan).
 * Tokens only; matches plan stroke dialect from color-tokens.css.
 */
export function BoardInkLegend({ onClose }: Props) {
  return (
    <CameraChrome place={{ kind: "dock" }} zIndex={38} testId="board-ink-legend-chrome">
      <aside
        className={`${kit.dock} ${css.root}`}
        data-testid="board-ink-legend"
        aria-label="Board ink legend"
      >
        <div className={kit.head}>
          <p className={kit.kicker}>Ink</p>
          <button
            type="button"
            className={kit.close}
            aria-label="Close ink legend"
            data-testid="board-ink-legend-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <ul className={css.list}>
          {ROWS.map((row) => (
            <li key={row.key} className={css.row} data-ink={row.key}>
              <span
                className={css.swatch}
                style={{ background: row.token }}
                aria-hidden
              />
              <span className={css.label}>{row.label}</span>
            </li>
          ))}
        </ul>
      </aside>
    </CameraChrome>
  );
}
