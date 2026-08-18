"use client";

/**
 * Gold Standard 2026 — Inspector Card (selection-driven property panel).
 *
 * Panel states are locked in the scoping pass
 * (docs/agent-prompts/inspector-scope-output.md §4): zero refs → not
 * mounted; one ref → form mode with per-field commit (no OK/cancel);
 * many refs → read-only summary. photoStroke refs render a conditional
 * provenance row only. Boundary re-clamp notices are dismissible and
 * re-arm on the next clamped edit.
 */

import type { CSSProperties, ReactNode } from "react";
import type {
  CatalogPlacement,
  LandscapeFeature,
  PhotoElevation,
} from "@workstream/contracts";
import { GlassCard } from "./GlassCard";
import type { SelectionRef } from "./selectionPick";
import { useStudioStore } from "./studioStore";

const titleCss: CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--gs-ink)",
  marginBottom: 8,
};

const hintCss: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  color: "var(--gs-ink-secondary)",
  marginTop: 8,
};

const provenanceCss: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  color: "var(--gs-ink-secondary)",
  marginBottom: 8,
};

const alertCss: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  color: "#C41E1E",
  border: "1px solid color-mix(in srgb, #C41E1E 45%, transparent)",
  borderRadius: "var(--gs-radius-chip)",
  padding: "6px 8px",
  marginBottom: 8,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const dismissCss: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#C41E1E",
  cursor: "pointer",
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  padding: 0,
};

const fieldRowCss: CSSProperties = { marginBottom: 6 };

const fieldLabelCss: CSSProperties = {
  display: "block",
  fontFamily: "var(--font-ui)",
  fontSize: 10,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--gs-ink-secondary)",
  marginBottom: 2,
};

const inputCss: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--font-ui)",
  fontSize: 12,
  padding: "4px 6px",
  borderRadius: "var(--gs-radius-chip)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 60%, transparent)",
  background: "transparent",
  color: "var(--gs-ink)",
};

const listCss: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const liCss: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  color: "var(--gs-ink)",
  padding: "2px 0",
};

function Field({
  labelText,
  children,
}: {
  labelText: string;
  children: ReactNode;
}) {
  return (
    <div style={fieldRowCss}>
      <span style={fieldLabelCss}>{labelText}</span>
      {children}
    </div>
  );
}

function placementSourceLabel(
  source: CatalogPlacement["source"],
): string | null {
  if (source === "vicmap_tree") return "Vicmap urban tree";
  if (source === "canopy") return "Vision-detected canopy";
  return null;
}

function refLabel(
  ref: SelectionRef,
  placements: CatalogPlacement[],
  features: LandscapeFeature[],
  photoElevations: PhotoElevation[],
): string {
  if (ref.kind === "placement") {
    const p = placements.find((x) => x.id === ref.id);
    return p ? `${p.symbol_id} · placement` : `placement ${ref.id}`;
  }
  if (ref.kind === "feature") {
    const f = features.find((x) => x.id === ref.id);
    return f
      ? `${f.metadata.friendly_name ?? f.material_fill?.sku ?? "feature"} · feature`
      : `feature ${ref.id}`;
  }
  const elev = photoElevations.find((e) => e.id === ref.elevationId);
  return elev ? `trace on ${elev.name} · photo stroke` : "photo trace stroke";
}

function PlacementInspector({ p }: { p: CatalogPlacement }) {
  const update = useStudioStore((s) => s.updatePlacementField);
  const notice = useStudioStore((s) => s.boundaryNotice);
  const dismiss = useStudioStore((s) => s.dismissBoundaryNotice);
  const source = placementSourceLabel(p.source);

  return (
    <GlassCard position={{ position: "relative" }} style={{ width: 260, padding: 12 }}>
      <div style={titleCss}>Placement</div>
      {notice && notice.refId === p.id ? (
        <div style={alertCss} data-testid="inspector-boundary-notice">
          <span>{notice.reason}</span>
          <button
            type="button"
            style={dismissCss}
            onClick={dismiss}
            data-testid="inspector-boundary-dismiss"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {source ? (
        <div style={provenanceCss} data-testid="inspector-placement-source">
          Source: {source}
        </div>
      ) : null}
      <Field labelText="SKU / species">
        <input
          key={`symbol-${p.id}`}
          defaultValue={p.symbol_id}
          data-testid="inspector-placement-symbol"
          style={inputCss}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v && v !== p.symbol_id) update(p.id, { symbol_id: v });
          }}
        />
      </Field>
      <Field labelText="Scale">
        <input
          key={`scale-${p.id}`}
          type="number"
          min="0.1"
          step="0.1"
          defaultValue={String(p.scale)}
          data-testid="inspector-placement-scale"
          style={inputCss}
          onChange={(e) => {
            const v = Number.parseFloat(e.currentTarget.value);
            if (Number.isFinite(v) && v > 0 && v !== p.scale) {
              update(p.id, { scale: v });
            }
          }}
        />
      </Field>
      <Field labelText="Rotation (deg)">
        <input
          key={`rotation-${p.id}`}
          type="number"
          min="0"
          max="360"
          step="1"
          defaultValue={String(p.rotation_deg)}
          data-testid="inspector-placement-rotation"
          style={inputCss}
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
        <input
          key={`label-${p.id}`}
          defaultValue={p.label ?? ""}
          data-testid="inspector-placement-label"
          style={inputCss}
          onBlur={(e) => {
            const v = e.currentTarget.value;
            if (v !== (p.label ?? "")) update(p.id, { label: v });
          }}
        />
      </Field>
      <Field labelText="Height (m)">
        <input
          key={`height-${p.id}`}
          type="number"
          min="0"
          step="0.1"
          defaultValue={p.height_m != null ? String(p.height_m) : ""}
          data-testid="inspector-placement-height"
          style={inputCss}
          onChange={(e) => {
            const v = Number.parseFloat(e.currentTarget.value);
            if (Number.isFinite(v) && v > 0 && v !== (p.height_m ?? 0)) {
              update(p.id, { height_m: v });
            }
          }}
        />
      </Field>
      <Field labelText="Canopy radius (m)">
        <input
          key={`canopy-${p.id}`}
          type="number"
          min="0"
          step="0.1"
          defaultValue={
            p.canopy_radius_m != null ? String(p.canopy_radius_m) : ""
          }
          data-testid="inspector-placement-canopy"
          style={inputCss}
          onChange={(e) => {
            const v = Number.parseFloat(e.currentTarget.value);
            if (Number.isFinite(v) && v > 0 && v !== (p.canopy_radius_m ?? 0)) {
              update(p.id, { canopy_radius_m: v });
            }
          }}
        />
      </Field>
    </GlassCard>
  );
}

function FeatureInspector({ f }: { f: LandscapeFeature }) {
  const update = useStudioStore((s) => s.updateFeatureField);
  const mf = f.material_fill;
  const scatter = f.procedural_scatter_contents;
  const labor = f.labor_profile;

  return (
    <GlassCard position={{ position: "relative" }} style={{ width: 260, padding: 12 }}>
      <div style={titleCss}>Feature · {f.metadata.layer}</div>
      <Field labelText="Name">
        <input
          key={`name-${f.id}`}
          defaultValue={f.metadata.friendly_name ?? ""}
          data-testid="inspector-feature-name"
          style={inputCss}
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
            <input
              key={`sku-${f.id}`}
              defaultValue={mf.sku}
              data-testid="inspector-feature-sku"
              style={inputCss}
              onBlur={(e) => {
                const v = e.currentTarget.value.trim();
                if (v && v !== mf.sku) update(f.id, { material_fill: { sku: v } });
              }}
            />
          </Field>
          <Field labelText="Depth (m)">
            <input
              key={`depth-${f.id}`}
              type="number"
              min="0"
              step="0.01"
              defaultValue={String(mf.depth_m)}
              data-testid="inspector-feature-depth"
              style={inputCss}
              onChange={(e) => {
                const v = Number.parseFloat(e.currentTarget.value);
                if (Number.isFinite(v) && v > 0 && v !== mf.depth_m) {
                  update(f.id, { material_fill: { depth_m: v } });
                }
              }}
            />
          </Field>
          <Field labelText="Waste (%)">
            <input
              key={`waste-${f.id}`}
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={String(mf.waste_allocation_pct)}
              data-testid="inspector-feature-waste"
              style={inputCss}
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
      {scatter ? (
        <Field labelText="Planting recipe">
          <input
            key={`recipe-${f.id}`}
            defaultValue={scatter.brush_recipe_id}
            data-testid="inspector-feature-recipe"
            style={inputCss}
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
          <select
            key={`tier-${f.id}`}
            defaultValue={labor.base_difficulty_tier}
            data-testid="inspector-feature-tier"
            style={inputCss}
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
          </select>
        </Field>
      ) : null}
    </GlassCard>
  );
}

function PhotoStrokeInspector({ ref }: { ref: SelectionRef }) {
  const elev = useStudioStore((s) =>
    s.photoElevations.find((e) => e.id === ref.elevationId),
  );
  if (!elev) return null;
  return (
    <GlassCard position={{ position: "relative" }} style={{ width: 260, padding: 12 }}>
      <div style={titleCss}>Photo trace stroke</div>
      <div style={provenanceCss} data-testid="inspector-stroke-provenance">
        Traced on {elev.name}
      </div>
      <div style={hintCss}>
        Elevation-space stroke — not editable in plan view.
      </div>
    </GlassCard>
  );
}

function SelectionSummary() {
  const selection = useStudioStore((s) => s.selection);
  const placements = useStudioStore((s) => s.placements);
  const features = useStudioStore((s) => s.features);
  const photoElevations = useStudioStore((s) => s.photoElevations);
  return (
    <GlassCard position={{ position: "relative" }} style={{ width: 260, padding: 12 }}>
      <div style={titleCss}>{selection.length} selected</div>
      <ul style={listCss}>
        {selection.map((r) => (
          <li key={`${r.kind}:${r.id}`} style={liCss}>
            {refLabel(r, placements, features, photoElevations)}
          </li>
        ))}
      </ul>
      <div style={hintCss}>Select one entity to edit its properties</div>
    </GlassCard>
  );
}

export function InspectorCard() {
  const selection = useStudioStore((s) => s.selection);
  const placements = useStudioStore((s) => s.placements);
  const features = useStudioStore((s) => s.features);

  // Zero refs → not mounted (zero-chrome).
  if (selection.length === 0) return null;
  // Many refs → read-only summary (single-selection editing only in v1).
  if (selection.length > 1) return <SelectionSummary />;

  const ref = selection[0]!;
  if (ref.kind === "placement") {
    const p = placements.find((x) => x.id === ref.id);
    return p ? <PlacementInspector p={p} /> : null;
  }
  if (ref.kind === "feature") {
    const f = features.find((x) => x.id === ref.id);
    return f ? <FeatureInspector f={f} /> : null;
  }
  return <PhotoStrokeInspector ref={ref} />;
}
