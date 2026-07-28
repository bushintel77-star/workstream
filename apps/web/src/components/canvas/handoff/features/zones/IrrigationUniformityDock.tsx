"use client";

import type { IrrigUniformityReport } from "@workstream/domain";
import { CameraChrome } from "../../CameraChrome";
import css from "./irrigationUniformity.module.css";

type Props = {
  report: IrrigUniformityReport;
  onClose: () => void;
};

/**
 * CameraChrome readout for spray DU — never a GIS legend ribbon.
 */
export function IrrigationUniformityDock({ report, onClose }: Props) {
  return (
    <CameraChrome
      place={{ kind: "dock" }}
      zIndex={45}
      testId="irrigation-uniformity-chrome"
    >
      <aside
        className={css.dock}
        data-testid="irrigation-uniformity-dock"
        data-du={report.du != null ? report.du.toFixed(2) : "none"}
      >
        <div className={css.headRow}>
          <p className={css.kicker}>Spray uniformity</p>
          <button
            type="button"
            className={css.close}
            aria-label="Close uniformity wash"
            data-testid="irrigation-uniformity-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className={css.metric}>
          {report.du != null ? (
            <>
              DU {report.du.toFixed(2)}
              {report.cu != null ? (
                <span className={css.muted}> · CU {report.cu.toFixed(2)}</span>
              ) : null}
            </>
          ) : (
            "No coverage"
          )}
        </p>
        <p className={css.tip}>{report.tip}</p>
        <p className={css.legend}>
          <span className={css.swatchDry} /> dry
          <span className={css.swatchOk} /> even
          <span className={css.swatchWet} /> heavy
        </p>
        <p className={css.honesty}>
          Indicative throw from head spacing — confirm pressure on site.
        </p>
      </aside>
    </CameraChrome>
  );
}
