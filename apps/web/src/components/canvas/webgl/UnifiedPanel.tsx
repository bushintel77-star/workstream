"use client";

/**
 * Unified Panel — THE node inspector over the canvas.
 *
 * A proper inspector, not a chip: tall enough to hold detailed data,
 * wide enough for readable tables, with a history rail of previously
 * inspected nodes so the operator can click back through what they've
 * examined. Selection-driven: click any entity on the canvas and its
 * full data appears here.
 *
 * Sections:
 *   ┌───────────────────────────────┐
 *   │ Header: context + clear       │
 *   ├───────────────────────────────┤
 *   │ History rail (prev. nodes)    │  ← clickable, most recent first
 *   ├───────────────────────────────┤
 *   │                               │
 *   │ Detailed body:                │  ← full data for current node
 *   │   · Identity section          │
 *   │   · Dimensions section        │
 *   │   · Position section          │
 *   │   · Provenance section        │
 *   │   · Compliance section        │
 *   │                               │
 *   ├───────────────────────────────┤
 *   │ Estimator companion           │  ← separate floating element
 *   └───────────────────────────────┘
 *
 * Binding: user directive — "the right hand panel can be more detailed
 * and longer and hold previous node data and dynamically display the
 * current."
 */

import { useMemo, useState, type ReactNode } from "react";
import { useStudioStore } from "./studioStore";
import type { SelectionRef } from "./selectionPick";
import { buildCanopyCompliance } from "./canopyCompliance";
import { boundaryAreaM2 } from "./metaChips";
import { getCatalogSymbol } from "@workstream/domain";
import type { CatalogPlacement, LandscapeFeature } from "@workstream/contracts";
import type { PctPoint } from "./coordTransform";
import { ENTITY_ICON } from "./PerimeterTabStrip";

// ---------------------------------------------------------------------------
// Sizing — flush panel constants (DESIGN.md §3)
// ---------------------------------------------------------------------------

// PANEL_WIDTH is declared in the positioning section below (line ~154).
// The old sizing constants (GAP, MARGIN, MIN_HEIGHT) are retired with the
// floating positioning — the panel is flush (top:0, right:0, bottom:0).

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-micro)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--la-ink-muted)",
  padding: "8px 0 4px",
  borderTop: "1px solid var(--la-surface-muted)",
};

const dataRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  padding: "3px 0",
  gap: "var(--gs-space-3)",
};

const dataLabel: React.CSSProperties = {
  fontSize: "var(--gs-font-xs)",
  color: "var(--la-ink-muted)",
  flexShrink: 0,
};

const dataValue: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-xs)",
  color: "var(--la-ink)",
  textAlign: "right" as const,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
};

function Section({ title, icon, children }: { title: string; icon?: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ ...sectionLabel, display: "flex", alignItems: "center", gap: 5 }}>
        {icon && <span style={{ fontSize: "1.2em", opacity: 0.7 }}>{icon}</span>}
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={dataRow}>
      <span style={dataLabel}>{label}</span>
      <span style={dataValue}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context router (pure)
// ---------------------------------------------------------------------------

export type PanelContextKind =
  | "selection-placement"
  | "selection-feature"
  | "selection-photoStroke"
  | "selection-boundary"
  | "selection-building"
  | "selection-multi"
  | "tool-sketch"
  | "mode-survey"
  | "mode-sketch"
  | "mode-cad"
  | "mode-elevation"
  | "mode-garden"
  | "mode-quote";

export interface PanelContext {
  kind: PanelContextKind;
  ref: SelectionRef | null;
}

export function resolvePanelContext(
  selection: SelectionRef[],
  sketchArmed: boolean,
  mode: string,
): PanelContext {
  if (selection.length === 1) {
    const ref = selection[0]!;
    return { kind: `selection-${ref.kind}` as PanelContextKind, ref };
  }
  if (selection.length > 1) return { kind: "selection-multi", ref: selection[0] ?? null };
  if (sketchArmed) return { kind: "tool-sketch", ref: null };
  return { kind: `mode-${mode}` as PanelContextKind, ref: null };
}

// ---------------------------------------------------------------------------
// Positioning — FLUSH RIGHT (DESIGN.md §3)
// Full-height, fixed width, anchored to the right window edge.
// No floating, no boundary anchoring — deterministic on server AND client.
// ---------------------------------------------------------------------------

const PANEL_WIDTH = 320;

// ---------------------------------------------------------------------------
// History entry
// ---------------------------------------------------------------------------

interface HistoryEntry {
  ref: SelectionRef;
  /** Short label shown in the rail. */
  label: string;
}

function refLabel(
  ref: SelectionRef,
  placements: CatalogPlacement[],
  features: LandscapeFeature[],
): string {
  if (ref.kind === "boundary") return "Boundary";
  if (ref.kind === "building") return "Building";
  if (ref.kind === "placement") {
    const p = placements.find((x) => x.id === ref.id);
    if (!p) return "Placement";
    const sym = getCatalogSymbol(p.symbol_id);
    return p.label?.split("·")[0]?.trim() || sym?.label || p.symbol_id;
  }
  if (ref.kind === "feature") {
    const f = features.find((x) => x.id === ref.id);
    return f?.metadata?.friendly_name || f?.metadata?.layer || "Feature";
  }
  return "Photo stroke";
}

// ---------------------------------------------------------------------------
// Detailed inspector bodies
// ---------------------------------------------------------------------------

function PlacementDetail({
  placement,
  scaleM,
  boardAspect,
}: {
  placement: CatalogPlacement;
  scaleM: number;
  boardAspect: number;
}) {
  const sym = getCatalogSymbol(placement.symbol_id);
  const worldX = (placement.x_pct / 100) * scaleM;
  const worldY = (placement.y_pct / 100) * (scaleM * boardAspect);
  return (
    <>
      <Section title="Identity" icon="◆">
        <Row label="Label" value={placement.label ?? "—"} />
        <Row label="Symbol" value={sym?.label ?? placement.symbol_id} />
        {sym?.botanical_name && <Row label="Botanical" value={sym.botanical_name} />}
        <Row label="Source" value={placement.source ?? "operator"} />
      </Section>
      <Section title="Dimensions (mature)" icon="↕">
        <Row label="Height" value={placement.height_m != null ? `${placement.height_m.toFixed(1)} m` : "—"} />
        <Row
          label="Canopy radius"
          value={placement.canopy_radius_m != null ? `${placement.canopy_radius_m.toFixed(2)} m` : "—"}
        />
        {sym?.mature_height_m != null && (
          <Row label="Catalog height" value={`${sym.mature_height_m} m`} />
        )}
        {sym?.default_width_m != null && (
          <Row label="Catalog spread" value={`${sym.default_width_m} m`} />
        )}
        <Row label="Scale" value={placement.scale?.toFixed(2) ?? "1.00"} />
        <Row label="Rotation" value={`${placement.rotation_deg?.toFixed(0) ?? 0}°`} />
      </Section>
      <Section title="Position" icon="⌖">
        <Row label="Board" value={`${placement.x_pct.toFixed(1)}% · ${placement.y_pct.toFixed(1)}%`} />
        <Row label="World (m)" value={`${worldX.toFixed(1)} · ${worldY.toFixed(1)}`} />
      </Section>
    </>
  );
}

function FeatureDetail({ feature }: { feature: LandscapeFeature }) {
  const areaM2 = feature.material_fill?.live_calculations?.area_m2;
  const cost = feature.material_fill?.live_calculations?.cost_aud;
  return (
    <>
      <Section title="Identity" icon="◆">
        <Row label="Name" value={feature.metadata.friendly_name ?? "—"} />
        <Row label="Layer" value={feature.metadata.layer} />
        <Row label="Geometry" value={feature.geometry.type} />
        <Row label="Points" value={feature.geometry.points.length} />
      </Section>
      {feature.material_fill && (
        <Section title="Material" icon="▨">
          <Row label="SKU" value={feature.material_fill.sku ?? "—"} />
          <Row
            label="Depth"
            value={feature.material_fill.depth_m != null ? `${feature.material_fill.depth_m} m` : "—"}
          />
          <Row
            label="Waste"
            value={feature.material_fill.waste_allocation_pct != null ? `${feature.material_fill.waste_allocation_pct}%` : "—"}
          />
        </Section>
      )}
      {(areaM2 != null || cost != null) && (
        <Section title="Live calculations" icon="∑">
          {areaM2 != null && <Row label="Area" value={`${areaM2.toFixed(1)} m²`} />}
          {feature.material_fill?.live_calculations?.volume_m3 != null && (
            <Row
              label="Volume"
              value={`${feature.material_fill.live_calculations.volume_m3.toFixed(2)} m³`}
            />
          )}
          {cost != null && <Row label="Cost" value={`$${cost.toFixed(2)}`} />}
        </Section>
      )}
      {feature.labor_profile && (
        <Section title="Labor" icon="⏱">
          <Row label="Tier" value={feature.labor_profile.base_difficulty_tier} />
          {feature.labor_profile.estimated_install_hours != null && (
            <Row label="Hours" value={feature.labor_profile.estimated_install_hours.toFixed(1)} />
          )}
          {feature.labor_profile.calculated_labor_cost_aud != null && (
            <Row label="Cost" value={`$${feature.labor_profile.calculated_labor_cost_aud.toFixed(2)}`} />
          )}
        </Section>
      )}
      {feature.extrude_height_m != null && (
        <Section title="Extrusion" icon="▲">
          <Row label="Pad height" value={`${feature.extrude_height_m} m`} />
        </Section>
      )}
    </>
  );
}

function BoundaryDetail({
  boundaryPct,
  scaleM,
  boardAspect,
  lotAreaM2,
  placements,
}: {
  boundaryPct: PctPoint[];
  scaleM: number;
  boardAspect: number;
  lotAreaM2?: number | null;
  placements: CatalogPlacement[];
}) {
  const compliance = useMemo(
    () =>
      buildCanopyCompliance({
        placements,
        boundary: boundaryPct,
        scaleM,
        boardAspect,
        lotAreaM2,
      }),
    [boundaryPct, scaleM, boardAspect, lotAreaM2, placements],
  );
  const areaM2 = boundaryAreaM2(boundaryPct, scaleM, boardAspect);
  const perimeterM = useMemo(() => {
    let total = 0;
    for (let i = 0; i < boundaryPct.length; i++) {
      const a = boundaryPct[i]!;
      const b = boundaryPct[(i + 1) % boundaryPct.length]!;
      const ax = (a.x / 100) * scaleM;
      const ay = (a.y / 100) * (scaleM * boardAspect);
      const bx = (b.x / 100) * scaleM;
      const by = (b.y / 100) * (scaleM * boardAspect);
      total += Math.hypot(bx - ax, by - ay);
    }
    return total;
  }, [boundaryPct, scaleM, boardAspect]);

  return (
    <>
      <Section title="Geometry" icon="△">
        <Row label="Area" value={`${Math.round(areaM2).toLocaleString("en-AU")} m²`} />
        <Row label="Perimeter" value={`${perimeterM.toFixed(1)} m`} />
        <Row label="Vertices" value={boundaryPct.length} />
        {lotAreaM2 != null && lotAreaM2 > 0 && (
          <Row label="Title area" value={`${Math.round(lotAreaM2).toLocaleString("en-AU")} m²`} />
        )}
      </Section>
      {compliance && compliance.assessment.status !== "insufficient-data" && (
        <Section title="A2-6 Tree Canopy" icon="♣">
          <Row
            label="Provided"
            value={`${compliance.assessment.matureProvided} of ${compliance.assessment.required}`}
          />
          {compliance.assessment.shortfall > 0 && (
            <Row label="Shortfall" value={`${compliance.assessment.shortfall} more needed`} />
          )}
          {compliance.assessment.immature.length > 0 && (
            <Row label="Immature" value={compliance.assessment.immature.length} />
          )}
          {compliance.overhangingCount > 0 && (
            <Row label="Overhang" value={`${compliance.overhangingCount} crowns (advisory)`} />
          )}
        </Section>
      )}
      {compliance?.areaDisagreement && (
        <Section title="⚠ Data Quality" icon="⚠">
          <div style={{ fontSize: "var(--gs-font-xs)", color: "var(--gs-ink-conflict)", lineHeight: 1.4 }}>
            Title lot area and drawn boundary disagree — reconcile before relying on counts.
          </div>
        </Section>
      )}
      <Section title="Provenance" icon="ⓘ">
        <Row label="Source" value="Vicmap cadastre" />
        <Row label="Standard" value="GDA94 / MGA zone 55" />
      </Section>
    </>
  );
}

function BuildingDetail({
  buildingPct,
  scaleM,
  boardAspect,
  buildingSource,
}: {
  buildingPct: PctPoint[];
  scaleM: number;
  boardAspect: number;
  buildingSource: string | null;
}) {
  const areaM2 = boundaryAreaM2(buildingPct, scaleM, boardAspect);
  return (
    <>
      <Section title="Footprint" icon="■">
        <Row label="Area" value={`${Math.round(areaM2).toLocaleString("en-AU")} m²`} />
        <Row label="Vertices" value={buildingPct.length} />
        <Row label="Source" value={buildingSource ?? "unknown"} />
      </Section>
      <Section title="Note" icon="ℹ">
        <div style={{ fontSize: "var(--gs-font-xs)", color: "var(--la-ink-muted)", lineHeight: 1.4 }}>
          Building heights are never invented — footprint only unless measured.
        </div>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Mode body (fallback when nothing selected)
// ---------------------------------------------------------------------------

function ModeBody({
  mode,
  boundaryPct,
  scaleM,
  boardAspect,
  lotAreaM2,
  placements,
}: {
  mode: string;
  boundaryPct: PctPoint[];
  scaleM: number;
  boardAspect: number;
  lotAreaM2?: number | null;
  placements: CatalogPlacement[];
}) {
  const hasBoundary = boundaryPct.length >= 3;
  const compliance = useMemo(
    () =>
      hasBoundary
        ? buildCanopyCompliance({ placements, boundary: boundaryPct, scaleM, boardAspect, lotAreaM2 })
        : null,
    [hasBoundary, placements, boundaryPct, scaleM, boardAspect, lotAreaM2],
  );
  return (
    <>
      {hasBoundary && compliance && compliance.assessment.status !== "insufficient-data" && (
        <div data-testid="a26-canopy-summary">
          <Section title="A2-6 Tree Canopy" icon="♣">
            <Row
              label="Trees"
              value={`${compliance.assessment.matureProvided} / ${compliance.assessment.required}`}
            />
            <Row
              label="Status"
              value={compliance.assessment.status === "compliant" ? "Compliant" : "Shortfall"}
            />
          </Section>
        </div>
      )}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 120,
        padding: "20px 16px",
        textAlign: "center" as const,
      }}>
        <div style={{
          fontFamily: "var(--font-tech)",
          fontSize: "var(--gs-font-sm)",
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          color: "var(--la-ink)",
          fontWeight: 600,
          marginBottom: 12,
        }}>
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </div>
        <div style={{
          fontSize: "var(--gs-font-xs)",
          color: "var(--la-ink-muted)",
          lineHeight: 1.6,
        }}>
          Click a boundary line, building mass, or tree to inspect data.
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

export interface UnifiedPanelProps {
  mode: string;
  scaleM: number;
  boardAspect: number;
  boundaryPct: PctPoint[];
  buildingPct: PctPoint[] | null;
  buildingSource: string | null;
  lotAreaM2?: number | null;
}

export function UnifiedPanel({
  mode,
  scaleM,
  boardAspect,
  boundaryPct,
  buildingPct,
  buildingSource,
  lotAreaM2,
}: UnifiedPanelProps) {
  const selection = useStudioStore((s) => s.selection);
  const clearSelection = useStudioStore((s) => s.clearSelection);
  const selectRef = useStudioStore((s) => s.selectRef);
  const sketchMode = useStudioStore((s) => s.sketchMode);
  const placements = useStudioStore((s) => s.placements);
  const features = useStudioStore((s) => s.features);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const context = resolvePanelContext(selection, sketchMode, mode);
  const isSelection = context.kind.startsWith("selection-");

  // Track history: when a single-entity selection lands, push to the rail.
  const currentRef = selection.length === 1 ? selection[0] : null;
  const historyKey = currentRef ? `${currentRef.kind}:${currentRef.id}` : null;
  const lastTrackedRef = useState<string | null>(null);
  if (historyKey && lastTrackedRef[0] !== historyKey) {
    lastTrackedRef[1](historyKey);
    setHistory((prev) => {
      const entry: HistoryEntry = {
        ref: currentRef!,
        label: refLabel(currentRef!, placements, features),
      };
      // Dedupe: if the same ref is already the most recent, don't re-add.
      if (prev[0] && `${prev[0].ref.kind}:${prev[0].ref.id}` === historyKey) return prev;
      return [entry, ...prev].slice(0, 12);
    });
  }

  const headerLabel = isSelection
    ? context.kind === "selection-multi"
      ? `${selection.length} selected`
      : currentRef?.kind === "boundary"
        ? "Title Boundary"
        : currentRef?.kind === "building"
          ? "Building"
          : currentRef?.kind === "placement"
            ? "Placement"
            : currentRef?.kind === "feature"
              ? "Feature"
              : "Photo Stroke"
    : context.kind === "tool-sketch"
      ? "Sketch"
      : mode.charAt(0).toUpperCase() + mode.slice(1);

  return (
    <div
      data-testid="unified-panel"
      data-context={context.kind}
      data-gs-glass-card
      role="complementary"
      aria-label={`${headerLabel} inspector`}
      style={{
        /* FLUSH RIGHT — full-height docked panel (DESIGN.md §3).
         * No floating, no boundary anchoring, no animation. */
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: PANEL_WIDTH,
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
        zIndex: "var(--cf-z-chrome)",
        background: "var(--la-surface)",
        borderLeft: "1px solid var(--la-surface-muted)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--gs-space-2)",
          padding: "10px 14px 8px",
          borderBottom: "1px solid var(--la-surface-muted)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-sm)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--la-ink)",
            fontWeight: 600,
          }}
        >
          {headerLabel}
        </span>
        <span style={{ flex: 1 }} />
        {isSelection && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={clearSelection}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--la-ink-muted)",
              fontSize: "var(--gs-font-sm)",
              padding: "0 4px",
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* History rail — previously inspected nodes */}
      {history.length > 1 && (
        <div
          data-testid="unified-panel-history"
          style={{
            display: "flex",
            gap: 4,
            padding: "6px 10px",
            borderBottom: "1px solid var(--la-surface-muted)",
            overflowX: "auto",
            scrollbarWidth: "none",
            flexShrink: 0,
          }}
        >
          {history.map((h, i) => {
            const isCurrent = i === 0 && currentRef != null;
            return (
              <button
                key={`${h.ref.kind}:${h.ref.id}:${i}`}
                type="button"
                onClick={() => selectRef(h.ref)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "2px 7px",
                  borderRadius: "var(--gs-radius-pill)",
                  border: `1px solid ${isCurrent ? "var(--la-accent)" : "var(--la-surface-muted)"}`,
                  background: isCurrent ? "var(--la-surface-dim)" : "transparent",
                  color: isCurrent ? "var(--la-ink)" : "var(--la-ink-muted)",
                  fontFamily: "var(--font-ui)",
                  fontSize: "var(--gs-font-micro)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "1.1em", marginRight: 3, opacity: 0.6 }}>
                  {ENTITY_ICON[h.ref.kind] ?? "·"}
                </span>
                {h.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Detailed body */}
      <div
        data-testid="unified-panel-body"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          scrollbarWidth: "thin",
          padding: "6px 14px 12px",
        }}
      >
        {context.kind === "selection-boundary" ? (
          <BoundaryDetail
            boundaryPct={boundaryPct}
            scaleM={scaleM}
            boardAspect={boardAspect}
            lotAreaM2={lotAreaM2}
            placements={placements}
          />
        ) : context.kind === "selection-building" ? (
          <BuildingDetail
            buildingPct={buildingPct ?? []}
            scaleM={scaleM}
            boardAspect={boardAspect}
            buildingSource={buildingSource}
          />
        ) : context.kind === "selection-placement" && currentRef ? (
          (() => {
            const p = placements.find((x) => x.id === currentRef.id);
            return p ? <PlacementDetail placement={p} scaleM={scaleM} boardAspect={boardAspect} /> : null;
          })()
        ) : context.kind === "selection-feature" && currentRef ? (
          (() => {
            const f = features.find((x) => x.id === currentRef.id);
            return f ? <FeatureDetail feature={f} /> : null;
          })()
        ) : context.kind === "selection-multi" ? (
          <Section title="Selection">
            <div style={{ fontSize: "var(--gs-font-xs)", color: "var(--la-ink-muted)", lineHeight: 1.5 }}>
              {selection.length} entities selected. Shift-click to add, Esc to clear.
            </div>
            {selection.slice(0, 8).map((ref) => (
              <Row key={`${ref.kind}:${ref.id}`} label={ref.kind} value={refLabel(ref, placements, features)} />
            ))}
          </Section>
        ) : (
          <ModeBody
            mode={mode}
            boundaryPct={boundaryPct}
            scaleM={scaleM}
            boardAspect={boardAspect}
            lotAreaM2={lotAreaM2}
            placements={placements}
          />
        )}
      </div>
    </div>
  );
}
