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
 * Since the hidden right dock was retired (its bodies were mounted but
 * invisible behind `display:none`), this panel is also the home of the
 * mode bodies (survey setup, CAD drafter, sketch actions, garden
 * viewpoints) and the meta surfaces (sun / growth / layers / site /
 * terrain / studio) — composed by the studio and passed in as ReactNode
 * props so the context router decides what shows:
 *
 *   selection → editable inspector (detail tables + commit-on-blur fields)
 *   meta tab  → the meta surface, dialog semantics (focus trap + Esc)
 *   mode      → the mode body (survey checklist, CAD drafter, …)
 *
 * The bodies stack BELOW a live selection so picking a tree mid-survey
 * never hides the import CTA — the panel scrolls, critical surfaces
 * stay mounted.
 *
 * Binding: user directive — "the right hand panel can be more detailed
 * and longer and hold previous node data and dynamically display the
 * current."
 */

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useStudioStore } from "./studioStore";
import type { SelectionRef } from "./selectionPick";
import { buildCanopyCompliance } from "./canopyCompliance";
import { boundaryAreaM2 } from "./metaChips";
import { getCatalogSymbol } from "@workstream/domain";
import type { CatalogPlacement, LandscapeFeature } from "@workstream/contracts";
import type { PctPoint } from "./coordTransform";
import { ENTITY_ICON } from "./PerimeterTabStrip";
import { refLabel, placementSourceLabel } from "./selectionLabels";
import { Button } from "./Button";
import { Field, Input, Select } from "./Field";
import { SketchCadReviewCard } from "./SketchCadReviewCard";
import { useFocusTrap } from "../../../lib/use-focus-trap";

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

const noticeCss: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  color: "var(--gs-conflict)",
  border: "1px solid color-mix(in srgb, var(--gs-conflict) 45%, transparent)",
  borderRadius: "var(--gs-radius-chip)",
  padding: "6px 8px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "var(--gs-space-4)",
};

function Section({ title, icon, children }: { title: string; icon?: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ ...sectionLabel, display: "flex", alignItems: "center", gap: 4 }}>
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

// ---------------------------------------------------------------------------
// Detailed inspector bodies (read-only detail tables)
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
// Editable inspector fields — ported from the retired InspectorCard.
// Per-field commit (no OK/cancel); testids preserved so the e2e contract
// survives the move.
// ---------------------------------------------------------------------------

function PlacementEditFields({ p }: { p: CatalogPlacement }) {
  const update = useStudioStore((s) => s.updatePlacementField);
  const notice = useStudioStore((s) => s.boundaryNotice);
  const dismiss = useStudioStore((s) => s.dismissBoundaryNotice);
  const gizmoMode = useStudioStore((s) => s.gizmoMode);
  const setGizmoMode = useStudioStore((s) => s.setGizmoMode);
  const source = placementSourceLabel(p.source);

  return (
    <Section title="Edit placement" icon="✎">
      <Field labelText="Manipulator">
        <div style={{ display: "flex", gap: "var(--gs-space-2)" }}>
          <Button
            size="xs"
            data-testid="gizmo-move"
            aria-pressed={gizmoMode === "translate"}
            active={gizmoMode === "translate"}
            onClick={() =>
              setGizmoMode(gizmoMode === "translate" ? null : "translate")
            }
          >
            Move
          </Button>
          <Button
            size="xs"
            data-testid="gizmo-rotate"
            aria-pressed={gizmoMode === "rotate"}
            active={gizmoMode === "rotate"}
            onClick={() => setGizmoMode(gizmoMode === "rotate" ? null : "rotate")}
          >
            Rotate
          </Button>
          <Button
            size="xs"
            data-testid="gizmo-scale"
            aria-pressed={gizmoMode === "scale"}
            active={gizmoMode === "scale"}
            onClick={() => setGizmoMode(gizmoMode === "scale" ? null : "scale")}
          >
            Scale
          </Button>
        </div>
      </Field>
      {notice && notice.refId === p.id ? (
        <div style={noticeCss} data-testid="inspector-boundary-notice">
          <span>{notice.reason}</span>
          <Button
            variant="ghost"
            size="xs"
            style={{
              border: "none",
              padding: 0,
              color: "var(--gs-conflict)",
              fontWeight: 600,
            }}
            onClick={dismiss}
            data-testid="inspector-boundary-dismiss"
          >
            Dismiss
          </Button>
        </div>
      ) : null}
      {source ? (
        <div
          style={{ fontSize: "var(--gs-font-sm)", color: "var(--la-ink-muted)", margin: "4px 0" }}
          data-testid="inspector-placement-source"
        >
          Source: {source}
        </div>
      ) : null}
      <Field labelText="SKU / species">
        <Input
          key={`symbol-${p.id}`}
          defaultValue={p.symbol_id}
          data-testid="inspector-placement-symbol"
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v && v !== p.symbol_id) update(p.id, { symbol_id: v });
          }}
        />
      </Field>
      <Field labelText="Scale">
        <Input
          key={`scale-${p.id}`}
          type="number"
          min="0.1"
          step="0.1"
          defaultValue={String(p.scale)}
          data-testid="inspector-placement-scale"
          onChange={(e) => {
            const v = Number.parseFloat(e.currentTarget.value);
            if (Number.isFinite(v) && v > 0 && v !== p.scale) {
              update(p.id, { scale: v });
            }
          }}
        />
      </Field>
      <Field labelText="Rotation (deg)">
        <Input
          key={`rotation-${p.id}`}
          type="number"
          min="0"
          max="360"
          step="1"
          defaultValue={String(p.rotation_deg)}
          data-testid="inspector-placement-rotation"
          onChange={(e) => {
            const v = Number.parseFloat(e.currentTarget.value);
            if (
              Number.isFinite(v) &&
              v >= 0 &&
              v <= 360 &&
              v !== p.rotation_deg
            ) {
              update(p.id, { rotation_deg: v });
            }
          }}
        />
      </Field>
      <Field labelText="Label">
        <Input
          key={`label-${p.id}`}
          defaultValue={p.label ?? ""}
          data-testid="inspector-placement-label"
          onBlur={(e) => {
            const v = e.currentTarget.value;
            if (v !== (p.label ?? "")) update(p.id, { label: v });
          }}
        />
      </Field>
      <Field labelText="Height (m)">
        <Input
          key={`height-${p.id}`}
          type="number"
          min="0"
          step="0.1"
          defaultValue={p.height_m != null ? String(p.height_m) : ""}
          data-testid="inspector-placement-height"
          onChange={(e) => {
            const v = Number.parseFloat(e.currentTarget.value);
            if (Number.isFinite(v) && v > 0 && v !== (p.height_m ?? 0)) {
              update(p.id, { height_m: v });
            }
          }}
        />
      </Field>
      <Field labelText="Canopy radius (m)">
        <Input
          key={`canopy-${p.id}`}
          type="number"
          min="0"
          step="0.1"
          defaultValue={
            p.canopy_radius_m != null ? String(p.canopy_radius_m) : ""
          }
          data-testid="inspector-placement-canopy"
          onChange={(e) => {
            const v = Number.parseFloat(e.currentTarget.value);
            if (Number.isFinite(v) && v > 0 && v !== (p.canopy_radius_m ?? 0)) {
              update(p.id, { canopy_radius_m: v });
            }
          }}
        />
      </Field>
    </Section>
  );
}

function FeatureEditFields({
  f,
  scaleM,
  boardAspect,
}: {
  f: LandscapeFeature;
  scaleM: number;
  boardAspect: number;
}) {
  const update = useStudioStore((s) => s.updateFeatureField);
  const stitchRecord = useStudioStore((s) => s.stitchRecords[f.id]);
  const unstitchFeature = useStudioStore((s) => s.unstitchFeature);
  const mf = f.material_fill;
  const scatter = f.procedural_scatter_contents;
  const labor = f.labor_profile;

  return (
    <Section title={`Edit · ${f.metadata.layer}`} icon="✎">
      {stitchRecord ? (
        <Button
          variant="ghost"
          data-testid="feature-unstitch"
          onClick={() => unstitchFeature(f.id, scaleM, boardAspect)}
          title="Split the stitched geometry back into its source strokes — non-destructive, one undo step"
          style={{
            width: "100%",
            padding: "5px 8px",
            marginBottom: 8,
            border: "1px solid color-mix(in srgb, var(--gs-line-strong) 60%, transparent)",
            borderRadius: "var(--gs-radius-chip)",
          }}
        >
          Un-stitch ({stitchRecord.segments.length} source runs)
        </Button>
      ) : null}
      <Field labelText="Name">
        <Input
          key={`name-${f.id}`}
          defaultValue={f.metadata.friendly_name ?? ""}
          data-testid="inspector-feature-name"
          onBlur={(e) => {
            const v = e.currentTarget.value;
            if (v !== (f.metadata.friendly_name ?? "")) {
              update(f.id, { friendly_name: v });
            }
          }}
        />
      </Field>
      {mf ? (
        <>
          <Field labelText="Material SKU">
            <Input
              key={`sku-${f.id}`}
              defaultValue={mf.sku}
              data-testid="inspector-feature-sku"
              onBlur={(e) => {
                const v = e.currentTarget.value.trim();
                if (v && v !== mf.sku) update(f.id, { material_fill: { sku: v } });
              }}
            />
          </Field>
          <Field labelText="Depth (m)">
            <Input
              key={`depth-${f.id}`}
              type="number"
              min="0"
              step="0.01"
              defaultValue={String(mf.depth_m)}
              data-testid="inspector-feature-depth"
              onChange={(e) => {
                const v = Number.parseFloat(e.currentTarget.value);
                if (Number.isFinite(v) && v > 0 && v !== mf.depth_m) {
                  update(f.id, { material_fill: { depth_m: v } });
                }
              }}
            />
          </Field>
          <Field labelText="Waste (%)">
            <Input
              key={`waste-${f.id}`}
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={String(mf.waste_allocation_pct)}
              data-testid="inspector-feature-waste"
              onChange={(e) => {
                const v = Number.parseFloat(e.currentTarget.value);
                if (
                  Number.isFinite(v) &&
                  v >= 0 &&
                  v <= 100 &&
                  v !== mf.waste_allocation_pct
                ) {
                  update(f.id, { material_fill: { waste_allocation_pct: v } });
                }
              }}
            />
          </Field>
        </>
      ) : null}
      {f.geometry.type === "Polygon" ? (
        <Field labelText="Pad height (m)">
          <Input
            key={`pad-${f.id}`}
            type="number"
            min="0"
            step="0.05"
            defaultValue={
              f.extrude_height_m != null ? String(f.extrude_height_m) : ""
            }
            data-testid="inspector-feature-pad-height"
            title="Elevate the region into a cut/fill pad. Height is a property of a region, not a second way to draw one — 0 clears it."
            onChange={(e) => {
              const v = Number.parseFloat(e.currentTarget.value);
              if (Number.isFinite(v) && v >= 0 && v !== (f.extrude_height_m ?? 0)) {
                update(f.id, { extrude_height_m: v });
              }
            }}
          />
        </Field>
      ) : null}
      {scatter ? (
        <Field labelText="Planting recipe">
          <Input
            key={`recipe-${f.id}`}
            defaultValue={scatter.brush_recipe_id}
            data-testid="inspector-feature-recipe"
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              if (v && v !== scatter.brush_recipe_id) {
                update(f.id, { brush_recipe_id: v });
              }
            }}
          />
        </Field>
      ) : null}
      {labor ? (
        <Field labelText="Labor tier">
          <Select
            key={`tier-${f.id}`}
            defaultValue={labor.base_difficulty_tier}
            data-testid="inspector-feature-tier"
            onChange={(e) => {
              const v = e.currentTarget.value as
                | "easy"
                | "standard_soil"
                | "constrained"
                | "rock";
              if (v !== labor.base_difficulty_tier) {
                update(f.id, { labor_tier: v });
              }
            }}
          >
            <option value="easy">easy</option>
            <option value="standard_soil">standard_soil</option>
            <option value="constrained">constrained</option>
            <option value="rock">rock</option>
          </Select>
        </Field>
      ) : null}
    </Section>
  );
}

function PhotoStrokeDetail({ ref: photoRef }: { ref: SelectionRef }) {
  const elev = useStudioStore((s) =>
    s.photoElevations.find((e) => e.id === photoRef.elevationId),
  );
  if (!elev) return null;
  return (
    <Section title="Photo trace stroke" icon="✎">
      <Row label="Traced on" value={elev.name} />
      <div style={{ fontSize: "var(--gs-font-xs)", color: "var(--la-ink-muted)", lineHeight: 1.5 }}>
        Elevation-space stroke — not editable in plan view.
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Mode body (fallback when nothing selected and the mode has no ported body)
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
  /**
   * Mode bodies ported from the retired right dock — survey setup, CAD
   * drafter, sketch actions, garden viewpoints, the quote empty state.
   * Rendered below any live selection so critical surfaces stay mounted.
   */
  modeBodies?: Partial<
    Record<"survey" | "sketch" | "cad" | "garden" | "quote", ReactNode>
  >;
  /** Open meta surface (sun / growth / layers / site / terrain / studio).
   *  Takes the dialog slot: focus trap + Esc/close via onCloseMeta. */
  metaBody?: ReactNode;
  onCloseMeta?: () => void;
}

export function UnifiedPanel({
  mode,
  scaleM,
  boardAspect,
  boundaryPct,
  buildingPct,
  buildingSource,
  lotAreaM2,
  modeBodies,
  metaBody,
  onCloseMeta,
}: UnifiedPanelProps) {
  const selection = useStudioStore((s) => s.selection);
  const clearSelection = useStudioStore((s) => s.clearSelection);
  const selectRef = useStudioStore((s) => s.selectRef);
  const sketchMode = useStudioStore((s) => s.sketchMode);
  const placements = useStudioStore((s) => s.placements);
  const features = useStudioStore((s) => s.features);
  const photoElevations = useStudioStore((s) => s.photoElevations);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const context = resolvePanelContext(selection, sketchMode, mode);
  const isSelection = context.kind.startsWith("selection-");

  // Meta surfaces carry dialog semantics (the retired perimeter-panel's
  // role="dialog" + close): trap Tab inside the panel while one is open.
  const panelRef = useRef<HTMLDivElement>(null);
  const metaOpen = metaBody != null;
  useFocusTrap(metaOpen, panelRef, onCloseMeta);

  // Track history: when a single-entity selection lands, push to the rail.
  const currentRef = selection.length === 1 ? selection[0] : null;
  const historyKey = currentRef ? `${currentRef.kind}:${currentRef.id}` : null;
  const lastTrackedRef = useState<string | null>(null);
  if (historyKey && lastTrackedRef[0] !== historyKey) {
    lastTrackedRef[1](historyKey);
    setHistory((prev) => {
      const entry: HistoryEntry = {
        ref: currentRef!,
        label: refLabel(currentRef!, placements, features, photoElevations),
      };
      // Dedupe: if the same ref is already the most recent, don't re-add.
      if (prev[0] && `${prev[0].ref.kind}:${prev[0].ref.id}` === historyKey) return prev;
      return [entry, ...prev].slice(0, 12);
    });
  }

  // Selection body — the detail tables plus the editable fields.
  const selectionBody = useMemo(() => {
    if (context.kind === "selection-boundary") {
      return (
        <BoundaryDetail
          boundaryPct={boundaryPct}
          scaleM={scaleM}
          boardAspect={boardAspect}
          lotAreaM2={lotAreaM2}
          placements={placements}
        />
      );
    }
    if (context.kind === "selection-building") {
      return (
        <BuildingDetail
          buildingPct={buildingPct ?? []}
          scaleM={scaleM}
          boardAspect={boardAspect}
          buildingSource={buildingSource}
        />
      );
    }
    if (context.kind === "selection-placement" && currentRef) {
      const p = placements.find((x) => x.id === currentRef.id);
      if (!p) return null;
      return (
        <>
          <PlacementDetail placement={p} scaleM={scaleM} boardAspect={boardAspect} />
          <PlacementEditFields p={p} />
        </>
      );
    }
    if (context.kind === "selection-feature" && currentRef) {
      const f = features.find((x) => x.id === currentRef.id);
      if (!f) return null;
      return (
        <>
          <FeatureDetail feature={f} />
          <FeatureEditFields f={f} scaleM={scaleM} boardAspect={boardAspect} />
        </>
      );
    }
    if (context.kind === "selection-photoStroke" && currentRef) {
      return <PhotoStrokeDetail ref={currentRef} />;
    }
    if (context.kind === "selection-multi") {
      return (
        <Section title="Selection">
          <div style={{ fontSize: "var(--gs-font-xs)", color: "var(--la-ink-muted)", lineHeight: 1.5 }}>
            {selection.length} entities selected. Shift-click to add, Esc to clear.
          </div>
          {selection.slice(0, 8).map((ref) => (
            <Row key={`${ref.kind}:${ref.id}`} label={ref.kind} value={refLabel(ref, placements, features, photoElevations)} />
          ))}
          <div style={{ fontSize: "var(--gs-font-xs)", color: "var(--la-ink-muted)", marginTop: 4 }}>
            Select one entity to edit its properties.
          </div>
        </Section>
      );
    }
    return null;
  }, [context.kind, currentRef, boundaryPct, scaleM, boardAspect, lotAreaM2, placements, features, photoElevations, buildingPct, buildingSource, selection]);

  const modeBody =
    mode === "survey"
      ? modeBodies?.survey
      : mode === "sketch"
        ? modeBodies?.sketch
        : mode === "cad"
          ? modeBodies?.cad
          : mode === "garden"
            ? modeBodies?.garden
            : mode === "quote"
              ? modeBodies?.quote
              : undefined;

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

  // The body column breathes: each surface is separated by a hairline and
  // the column itself is the scroll container (full-height flush panel).
  const bodyGap: React.CSSProperties = {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    scrollbarWidth: "thin",
    display: "flex",
    flexDirection: "column",
    gap: "var(--gs-space-5)",
    padding: "6px 14px 24px",
  };

  return (
    <div
      ref={panelRef}
      data-testid="unified-panel"
      data-context={context.kind}
      data-gs-glass-card
      role={metaOpen ? "dialog" : "complementary"}
      aria-label={metaOpen ? "Canvas surface panel" : `${headerLabel} inspector`}
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
        {isSelection ? (
          <span
            data-testid="selection-chip"
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
            {" · "}
            <span data-testid="selection-count" style={{ fontWeight: 400 }}>
              {selection.length} selected
            </span>
          </span>
        ) : (
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
        )}
        <span style={{ flex: 1 }} />
        {metaOpen && onCloseMeta ? (
          <button
            type="button"
            aria-label="Close panel"
            onClick={onCloseMeta}
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
        ) : isSelection ? (
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
        ) : null}
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
                  gap: 2,
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

      {/* Detailed body — review card (self-gated) + selection + meta/mode */}
      <div
        data-testid="unified-panel-body"
        style={bodyGap}
      >
        {/* Sketch → CAD ghost review — store-gated (the card returns null
            while closed, wrapper included); docked here since the floating
            top-right card would sit under this flush panel. */}
        <SketchCadReviewCard docked />
        {selectionBody}
        {metaBody ?? modeBody ?? (
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
