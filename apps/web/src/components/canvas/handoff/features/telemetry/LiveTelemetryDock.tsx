"use client";

import type { TelemetryLatest, TelemetryReading } from "@workstream/contracts";
import {
  TELEMETRY_KIND_LABEL,
  buildTwinPerformanceAlerts,
  type TelemetryBoardPoint,
} from "@workstream/domain";
import { CameraChrome } from "../../CameraChrome";
import css from "./liveTelemetry.module.css";

type Props = {
  latest: TelemetryLatest[];
  readings: TelemetryReading[];
  points: TelemetryBoardPoint[];
  loading: boolean;
  onSeedDemo: () => void;
  onClose: () => void;
};

function formatValue(row: TelemetryLatest): string {
  const v =
    row.kind === "thermal_comfort" || row.kind === "flow"
      ? row.value.toFixed(1)
      : String(Math.round(row.value));
  return `${v} ${row.unit}`;
}

/**
 * Live telemetry sidecar — CameraChrome only (never under zoom-world).
 */
export function LiveTelemetryDock({
  latest,
  readings,
  points,
  loading,
  onSeedDemo,
  onClose,
}: Props) {
  const demoOnly =
    latest.length > 0 && latest.every((r) => r.source === "demo");
  const alerts = buildTwinPerformanceAlerts(readings);
  const alertN = alerts.length;

  return (
    <CameraChrome
      place={{ kind: "dock" }}
      zIndex={45}
      testId="live-telemetry-chrome"
    >
      <aside
        className={css.dock}
        data-testid="live-telemetry-dock"
        data-count={String(latest.length)}
        data-points={String(points.length)}
        data-alerts={String(alertN)}
      >
        <div className={css.headRow}>
          <p className={css.kicker}>Live telemetry</p>
          <button
            type="button"
            className={css.close}
            aria-label="Close live telemetry"
            data-testid="live-telemetry-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {latest.length === 0 ? (
          <>
            <p className={css.tip}>
              {loading
                ? "Loading samples…"
                : "No sensors yet — ingest soil moisture, comfort, flow, or sediment."}
            </p>
            <button
              type="button"
              className={css.seed}
              data-testid="live-telemetry-seed-demo"
              onClick={onSeedDemo}
              disabled={loading}
            >
              Load demo sensors
            </button>
          </>
        ) : (
          <>
            <ul className={css.list}>
              {latest.map((row) => (
                <li
                  key={row.reading_id}
                  className={css.row}
                  data-testid={`telemetry-latest-${row.kind}`}
                  data-source={row.source}
                >
                  <span className={css.kind}>
                    {row.label ?? TELEMETRY_KIND_LABEL[row.kind]}
                  </span>
                  <span className={css.value}>{formatValue(row)}</span>
                </li>
              ))}
            </ul>
            {alertN > 0 ? (
              <p className={css.alertTip} data-testid="live-telemetry-alerts">
                {alertN} performance alert{alertN === 1 ? "" : "s"} in findings
                — sediment / vegetation stress.
              </p>
            ) : null}
            <p className={css.honesty}>
              {demoOnly
                ? "Demo samples — not site sensors. Replace via POST /design/telemetry."
                : "Measured samples — confirm on site before maintenance decisions."}
            </p>
          </>
        )}
      </aside>
    </CameraChrome>
  );
}
