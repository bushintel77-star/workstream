"use client";

import { Button } from "../Button";
import type {
  AnnotationDialect,
  SurveyedPlanLegendEntry,
  SurveyedPlanNotationModel,
} from "./model";
import { groupedLegendEntries, visibleLegendEntries, type LegendFilter } from "./legend";
import type { TradeLegendEntry } from "./tradeModel";

const GROUP_LABEL: Record<SurveyedPlanLegendEntry["group"], string> = {
  boundaries: "Boundaries",
  levels: "Levels",
  plants: "Plants",
  materials: "Materials",
  callouts: "Callouts",
  scope: "Scope",
  conventions: "Conventions",
};

export function SurveyCommunicationCard({
  dialect,
  onDialect,
  toggles,
  onToggle,
  model,
  tradePacks,
  onTradePacks,
  tradeLegend = [],
  labels = {
    title: "Survey communication",
    technical: "Technical",
    architectural: "Architectural",
    creative: "Creative",
    hybrid: "Hybrid",
  },
  modes = ["technical", "architectural", "creative", "hybrid"],
}: {
  dialect: AnnotationDialect;
  onDialect: (dialect: AnnotationDialect) => void;
  toggles: LegendFilter & { enabled: boolean };
  onToggle: (patch: Partial<LegendFilter & { enabled: boolean }>) => void;
  model: SurveyedPlanNotationModel;
  tradePacks: {
    irrigationDrainage: boolean;
    hardscapeConstruction: boolean;
    lightingElectrical: boolean;
  };
  onTradePacks: (patch: Partial<{
    irrigationDrainage: boolean;
    hardscapeConstruction: boolean;
    lightingElectrical: boolean;
  }>) => void;
  tradeLegend?: TradeLegendEntry[];
  labels?: {
    title: string;
    technical: string;
    architectural: string;
    creative: string;
    hybrid: string;
  };
  modes?: AnnotationDialect[];
}) {
  const entries = visibleLegendEntries(model, toggles);
  const groups = groupedLegendEntries(entries);
  return (
    <section
      aria-label="Survey communication"
      data-testid="survey-communication-card"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-4)" }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--gs-space-2)" }}>
        <strong
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-sm)",
            letterSpacing: "0.05em",
            color: "var(--gs-ink)",
          }}
        >
          {labels.title}
        </strong>
        <Button
          variant="chip-preset"
          aria-pressed={toggles.enabled}
          active={toggles.enabled}
          onClick={() => onToggle({ enabled: !toggles.enabled })}
        >
          {toggles.enabled ? "On" : "Off"}
        </Button>
      </header>

      <div role="radiogroup" aria-label="Communication mode" style={{ display: "flex", gap: "var(--gs-space-2)", flexWrap: "wrap" }}>
        {modes.map((value) => (
          <Button
            key={value}
            variant="chip-preset"
            active={dialect === value}
            aria-pressed={dialect === value}
            onClick={() => onDialect(value)}
            data-testid={`survey-communication-mode-${value}`}
          >
            {labels[value]}
          </Button>
        ))}
      </div>

      <div role="group" aria-label="Legend filters" style={{ display: "flex", gap: "var(--gs-space-2)", flexWrap: "wrap" }}>
        {(
          [
            ["bearings", "Bearings"],
            ["elevations", "RL"],
            ["plants", "Plants"],
            ["materials", "Hatches"],
            ["callouts", "Callouts"],
            ["scope", "Scope"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant="chip-preset"
            active={toggles[key]}
            aria-pressed={toggles[key]}
            onClick={() => onToggle({ [key]: !toggles[key] })}
            data-testid={`survey-communication-filter-${key}`}
          >
            {label}
          </Button>
        ))}
      </div>

      <div role="group" aria-label="Trade communication packs" style={{ display: "flex", gap: "var(--gs-space-2)", flexWrap: "wrap" }}>
        {(
          [
            ["irrigationDrainage", "Irrigation and drainage"],
            ["hardscapeConstruction", "Hardscape construction"],
            ["lightingElectrical", "Lighting electrical"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant="chip-preset"
            active={tradePacks[key]}
            aria-pressed={tradePacks[key]}
            onClick={() => onTradePacks({ [key]: !tradePacks[key] })}
            data-testid={`trade-pack-${key}`}
          >
            {label}
          </Button>
        ))}
      </div>

      <section
        data-testid="survey-communication-legend"
        aria-label="Legend and notation key"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--gs-space-3)",
          border: "1px solid var(--gs-line-soft)",
          borderRadius: "var(--gs-radius-lg)",
          padding: "8px 10px",
          background: "color-mix(in srgb, var(--gs-canvas) 88%, transparent)",
        }}
      >
        {groups.map((group) => (
          <div key={group.group} style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-2)" }}>
            <strong style={{ fontFamily: "var(--font-tech)", fontSize: "var(--gs-font-xs)", color: "var(--gs-ink-secondary)" }}>
              {GROUP_LABEL[group.group]}
            </strong>
            {group.entries.map((entry) => {
              const style = model.styleProfile.categories[entry.category];
              return (
                <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "22px 108px 1fr", gap: "var(--gs-space-2)", alignItems: "center" }}>
                  {/* Stroke swatch — the legend is where the operator reads that
                      Truth Anchor blue means surveyed truth and ink means design
                      intent, so it draws from the same dialect profile the canvas
                      does rather than restating the colours. */}
                  <span
                    aria-hidden
                    data-testid={`legend-swatch-${entry.category}`}
                    style={{
                      display: "block",
                      width: 18,
                      borderTop: `${style.strokeWidth}px ${style.dash != null ? "dashed" : "solid"} ${style.stroke}`,
                    }}
                  />
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: "var(--gs-font-xs)", color: "var(--gs-ink)" }}>
                    {entry.label}
                  </span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: "var(--gs-font-xs)", color: "var(--gs-ink-secondary)" }}>
                    {entry.value}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {tradeLegend.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-2)" }}>
            <strong style={{ fontFamily: "var(--font-tech)", fontSize: "var(--gs-font-xs)", color: "var(--gs-ink-secondary)" }}>
              Trades
            </strong>
            {tradeLegend.map((entry) => (
              <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "var(--gs-space-2)" }}>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: "var(--gs-font-xs)", color: "var(--gs-ink)" }}>
                  {entry.label}
                </span>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: "var(--gs-font-xs)", color: "var(--gs-ink-secondary)" }}>
                  {entry.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}
