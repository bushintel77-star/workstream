"use client";

/**
 * Layers panel — opens when the LAYERS ribbon tool is armed (activeTool ===
 * "layers"). Built over the repo's real plane model (ground + spatial canvases)
 * and the live analysis/WFS toggles — every control drives real store state,
 * nothing is fabricated.
 *
 * Honest omissions (not yet in the model, deliberately not faked):
 *   - the spec's fixed 4-plane z-stack (survey −0.02 / ground / planting /
 *     massing) — the studio uses ground + user-placed canvases instead (1.1);
 *   - per-plane opacity/lock and STATE/STAGE filters (no store support yet).
 */

import type { DesignKeylessOverlay } from "@workstream/contracts";
import {
  OVERLAY_COLORS,
  OVERLAY_LABELS,
  OVERLAY_ORDER,
  isOverlayVisible,
} from "./overlayMeta";
import { FIXED_PLANES } from "./planeStack";
import { useStudioStore } from "./studioStore";
import s from "./LayersPanel.module.css";

function formatPullTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

export function LayersPanel({ overlays }: { overlays: DesignKeylessOverlay[] }) {
  const canvases = useStudioStore((st) => st.sketchCanvases);
  const activeCanvasId = useStudioStore((st) => st.activeCanvasId);
  const setActiveCanvasId = useStudioStore((st) => st.setActiveCanvasId);
  const strokes = useStudioStore((st) => st.sketchStrokes);
  const placements = useStudioStore((st) => st.placements);
  const hiddenOverlayKinds = useStudioStore((st) => st.hiddenOverlayKinds);
  const toggleOverlayKind = useStudioStore((st) => st.toggleOverlayKind);
  const subsurfaceView = useStudioStore((st) => st.subsurfaceView);
  const setSubsurfaceView = useStudioStore((st) => st.setSubsurfaceView);
  const suncastView = useStudioStore((st) => st.suncastView);
  const setSuncastView = useStudioStore((st) => st.setSuncastView);
  const drainageView = useStudioStore((st) => st.drainageView);
  const setDrainageView = useStudioStore((st) => st.setDrainageView);
  const earthworksView = useStudioStore((st) => st.earthworksView);
  const setEarthworksView = useStudioStore((st) => st.setEarthworksView);

  const presentKinds = OVERLAY_ORDER.filter((k) =>
    overlays.some((o) => o.kind === k),
  );

  return (
    <div className={s.panel} data-testid="layers-panel">
      <div className={s.title}>Layers</div>

      <div className={s.sectionLabel}>Planes</div>
      {FIXED_PLANES.map((p) =>
        p.drawable ? (
          <PlaneRow
            key={p.id}
            z={p.z.toFixed(2)}
            name={p.name}
            badge="DRAWING"
            strokes={strokes.filter((x) => !x.canvas_id).length}
            objects={placements.length}
            active={activeCanvasId === null}
            onSelect={() => setActiveCanvasId(null)}
          />
        ) : (
          <FixedPlaneRow
            key={p.id}
            z={p.z.toFixed(2)}
            name={p.name}
            tag={p.readOnly ? "IMPORTED" : "PROPOSED"}
            locked={p.readOnly}
          />
        ),
      )}
      {canvases.map((c) => (
        <PlaneRow
          key={c.id}
          z={c.position[1].toFixed(2)}
          name={c.label?.trim() || `Plane +${c.position[1].toFixed(1)}m`}
          strokes={strokes.filter((x) => x.canvas_id === c.id).length}
          objects={0}
          active={activeCanvasId === c.id}
          onSelect={() => setActiveCanvasId(c.id)}
        />
      ))}

      <div className={s.sectionLabel}>Analysis · derived</div>
      <ToggleRow
        label="Subsurface"
        on={subsurfaceView}
        onToggle={() => setSubsurfaceView(!subsurfaceView)}
      />
      <ToggleRow
        label="Suncast"
        on={suncastView}
        onToggle={() => setSuncastView(!suncastView)}
      />
      <ToggleRow
        label="Overland flow"
        on={drainageView}
        onToggle={() => setDrainageView(!drainageView)}
      />
      <ToggleRow
        label="Earthworks"
        on={earthworksView}
        onToggle={() => setEarthworksView(!earthworksView)}
      />

      {presentKinds.length > 0 && (
        <>
          <div className={s.sectionLabel}>WFS overlays · read-only</div>
          {presentKinds.map((kind) => {
            const overlay = overlays.find((o) => o.kind === kind);
            const visible = isOverlayVisible(hiddenOverlayKinds, kind);
            return (
              <button
                key={kind}
                type="button"
                className={s.row}
                onClick={() => toggleOverlayKind(kind)}
                aria-pressed={visible}
                data-overlay-kind={kind}
              >
                <span
                  className={s.swatch}
                  style={{ backgroundColor: OVERLAY_COLORS[kind] }}
                />
                <span className={s.rowLabel}>{OVERLAY_LABELS[kind]}</span>
                <span className={s.pullTime}>
                  {overlay?.fetched_at
                    ? `pulled ${formatPullTime(overlay.fetched_at)}`
                    : ""}
                </span>
                <span className={`${s.tick} ${visible ? s.tickOn : ""}`} />
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}

function PlaneRow({
  z,
  name,
  badge,
  strokes,
  objects,
  active,
  onSelect,
}: {
  z: string;
  name: string;
  badge?: string;
  strokes: number;
  objects: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${s.row} ${active ? s.rowActive : ""}`}
      onClick={onSelect}
      aria-pressed={active}
      data-plane-row={name}
    >
      <span className={s.z}>{z}</span>
      <span className={s.rowLabel}>
        {name}
        {badge ? <span className={s.badge}>{badge}</span> : null}
      </span>
      <span className={s.counts}>
        {strokes} strokes · {objects} objects
      </span>
    </button>
  );
}

/** Non-selectable reference row for proposed/imported fixed planes — no
 *  click target, because the plane cannot accept drawing geometry yet. */
function FixedPlaneRow({
  z,
  name,
  tag,
  locked,
}: {
  z: string;
  name: string;
  tag: string;
  locked: boolean;
}) {
  return (
    <div className={s.row} data-plane-row={name}>
      <span className={s.z}>{z}</span>
      <span className={s.rowLabel}>
        {name}
        <span className={`${s.badge} ${locked ? s.badgeLocked : s.badgeProposed}`}>
          {tag}
        </span>
      </span>
      <span className={s.counts}>—</span>
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={s.row}
      onClick={onToggle}
      aria-pressed={on}
      data-analysis-toggle={label.toLowerCase().replace(/\s+/g, "-")}
    >
      <span className={s.rowLabel}>{label}</span>
      <span className={`${s.tick} ${on ? s.tickOn : ""}`} />
    </button>
  );
}
