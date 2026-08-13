import type { Metadata } from "next";
import type { SpatialObject } from "@workstream/contracts";
import { FloatingHUD } from "../components/landing/FloatingHUD";
import { MetaChip } from "../components/landing/MetaChip";
import { SiteTruthSearch } from "../components/landing/SiteTruthSearch";
import css from "./landing.module.css";

export const metadata: Metadata = {
  title: "Workstream Gold Standard 2026",
  description: "Zero-chrome canvas-first landscape design studio.",
  robots: { index: true, follow: true },
};

const acquisitionItems = [
  { label: "Parcel boundary", tone: "gold" as const },
  { label: "VicMap base", tone: "normal" as const },
  { label: "Title search", tone: "normal" as const },
  { label: "Easements", tone: "dimmed" as const },
];

const pipelineSteps = [
  { icon: "✓", label: "Geo-location anchored", state: "complete" },
  { icon: "↻", label: "Title photo capture", state: "active" },
  { icon: "○", label: "Utility survey fetch", state: "pending" },
  { icon: "○", label: "Terrain mesh generation", state: "pending" },
];

const truthRows = [
  { label: "Lat/Long", value: "37.8136° S, 144.9631° E", tone: "gold" },
  { label: "Aspect", value: "North-facing", tone: "default" },
  { label: "Status", value: "Active", tone: "blue" },
];

const hydrologyFact: SpatialObject = {
  id: "hydrology-scan",
  layer: "irrigation",
  label: "Hydrology scan",
  source: "irrigation",
  area_m2: 0,
  length_m: 0,
  count: 1,
  pressure_drop_kpa: 3.1,
  strike_alert: false,
};

export default function LandingPage() {
  return (
    <main
      className={css.page}
      data-testid="workstream-landing"
      data-origin-locked="true"
    >
      <div className={css.canvasSurface} aria-hidden="true">
        <div className={css.canvasBase} />
        <div className={css.gridOverlay} />
        <div className={css.canvasVignette} />

        <div className={css.captureFrame}>
          <div className={css.captureBorder}>
            <svg
              className={css.captureSvg}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <line
                className={css.propertyBoundary}
                x1="10"
                y1="10"
                x2="90"
                y2="20"
              />
              <line
                className={css.propertyBoundary}
                x1="90"
                y1="20"
                x2="85"
                y2="90"
              />
              <line
                className={css.propertyBoundary}
                x1="85"
                y1="90"
                x2="15"
                y2="85"
              />
              <line
                className={css.propertyBoundary}
                x1="15"
                y1="85"
                x2="10"
                y2="10"
              />
            </svg>
          </div>
        </div>

        <div className={css.originCrosshair}>
          <div className={css.originHorizontal} />
          <div className={css.originVertical} />
          <div className={css.originNode} />
          <div className={css.originLabel}>Local origin (0,0,0)</div>
        </div>
      </div>

      <FloatingHUD
        as="section"
        className={css.searchHud}
        padding="lg"
        tone="default"
        aria-labelledby="site-truth-title"
      >
        <h1 id="site-truth-title" className={css.searchTitle}>
          Acquire Site Truth
        </h1>
        <p className={css.searchCopy}>
          Enter global coordinates or address to initiate automated data capture
          pipeline.
        </p>
        <SiteTruthSearch />
      </FloatingHUD>

      <FloatingHUD
        as="aside"
        className={css.pipelineHud}
        padding="md"
        tone="default"
        aria-labelledby="pipeline-title"
      >
        <div className={css.panelHeader}>
          <h2 id="pipeline-title" className={css.panelTitle}>
            Pipeline status
          </h2>
          <span className={css.runningStatus}>Running...</span>
        </div>
        <div className={css.chipList}>
          {acquisitionItems.map((item, index) => (
            <MetaChip
              key={item.label}
              label={item.label}
              tone={item.tone}
              revealDelayMs={index * 300}
            />
          ))}
        </div>
        <ul className={css.stepList}>
          {pipelineSteps.map((step) => (
            <li key={step.label} className={css[`step-${step.state}`]}>
              <span className={css.stepIcon} aria-hidden="true">
                {step.icon}
              </span>
              <span>{step.label}</span>
            </li>
          ))}
        </ul>
      </FloatingHUD>

      <div className={css.telemetryStack}>
        <FloatingHUD
          as="aside"
          className={css.telemetryHud}
          padding="md"
          tone="default"
          aria-labelledby="telemetry-title"
        >
          <h2 id="telemetry-title" className={css.panelTitle}>
            <span className={css.radarGlyph} aria-hidden="true" />
            Site telemetry
          </h2>
          <dl className={css.dataList}>
            {truthRows.map((row) => (
              <div key={row.label} className={css.dataRow}>
                <dt>{row.label}</dt>
                <dd className={css[`data-${row.tone}`]}>
                  {row.tone === "blue" ? (
                    <span className={css.activeValue}>
                      <span className={css.statusDot} aria-hidden="true" />
                      {row.value}
                    </span>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </FloatingHUD>

        <FloatingHUD
          as="aside"
          className={css.hydrologyHud}
          padding="md"
          tone="default"
          aria-labelledby="hydrology-title"
        >
          <h2 id="hydrology-title" className={css.panelTitle}>
            <span className={css.waterGlyph} aria-hidden="true" />
            Hydrology scans
          </h2>
          <dl className={css.dataList}>
            <div className={css.dataRowPlain}>
              <dt>Flow rate</dt>
              <dd>14.2 L/s</dd>
            </div>
            <div className={css.dataRowPlain}>
              <dt>Pressure drop</dt>
              <dd>{hydrologyFact.pressure_drop_kpa?.toFixed(1)} kPa</dd>
            </div>
          </dl>
          <div className={css.alertRow}>
            <span>
              <span className={css.alertGlyph} aria-hidden="true">
                !
              </span>
              Strike alert
            </span>
            <strong>{hydrologyFact.strike_alert ? "High" : "Low"}</strong>
          </div>
        </FloatingHUD>
      </div>
    </main>
  );
}
