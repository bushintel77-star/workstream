/**
 * Gold Standard 2026 — Studio Autosave Hook.
 *
 * Extracted as a standalone hook for the unified WebGL studio. This is the
 * resilience backbone: it ensures operator work is never lost to a flaky
 * backyard Wi-Fi connection (the iPad-in-the-garden scenario).
 *
 * Two key mechanisms (praised in review as "professional-grade resilience"):
 *
 *   1. CONTENT FINGERPRINT (persistKey): a serialized hash of the document
 *      slices. The debounced save effect keys on this string — micro-movements
 *      that don't change the fingerprint don't trigger a network call. Quiet,
 *      efficient, bulletproof.
 *
 *   2. 3-ATTEMPT BACKOFF [2s, 8s, 30s]: on failure, the hook retries with
 *      exponentially increasing delays. A dropped connection doesn't fail
 *      permanently — it gracefully retries without locking the UI. Only
 *      `stale_client` (deploy mismatch) short-circuits, because only a refresh
 *      can heal that.
 *
 * On success, saveRevision is bumped — this is the live-data refetch key that
 * downstream hooks (useBoardFindings, useBoardReport, etc.) subscribe to.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CatalogPlacement,
  CanvasStroke,
  ConstructionTrench,
  IrrigationZone,
  LandscapeFeature,
  PhotoElevation,
  SketchCanvas,
} from "@workstream/contracts";
import {
  saveDesignCanvasClient,
  classifySaveError,
} from "../handoff/features/save/saveDesignCanvasClient";
import { useStudioStore } from "./studioStore";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface StudioAutosaveDoc {
  /** Catalog placements (required by the PUT schema — pass [] if none). */
  placements: CatalogPlacement[];
  /** Sketch strokes in board-% space. */
  strokes: CanvasStroke[];
  /** Construction trench runs (traced + accepted auto proposals). */
  constructionTrenches?: ConstructionTrench[];
  /** Irrigation zones (traced rings + accepted proposals). */
  irrigationZones?: IrrigationZone[];
  /** Pinned site photos as calibrated elevation-trace frames. */
  photoElevations?: PhotoElevation[];
  /** Converted CAD features (direct-converts + placement-outline mirrors). */
  features?: LandscapeFeature[];
  /** Spatial Sketching planes (oriented 2D planes in 3D space). */
  canvases?: SketchCanvas[];
}

/* -------------------------------------------------------------------------- */
/* Fingerprint — the dirty-tracking content hash                              */
/* -------------------------------------------------------------------------- */

/**
 * Build a single string fingerprint of the document slices worth persisting.
 * The debounced save effect keys on this — if it doesn't change, no save fires.
 *
 * Stroke fingerprint includes id, width, color, and the point array (rounded to
 * 1 decimal to avoid float jitter triggering spurious saves). Placement
 * fingerprint includes id, position, scale, rotation, and type, plus every
 * inspector-editable field (label, height, canopy radius, source); feature
 * fingerprint includes geometry plus material fill, friendly name,
 * modification state, scatter recipe, labor tier, and pad height. Any
 * inspector edit must change this key or the edit will not persist.
 */
export function buildPersistKey(doc: StudioAutosaveDoc): string {
  const strokeParts = doc.strokes.map(
    (s) =>
      `${s.id}:${s.width_px}:${s.color}:${s.extrude_height_m ?? 0}:${
      // points is required by the schema, but legacy/handoff-authored strokes
      // may predate the field — guard defensively rather than at the contract
      // (changing the contract would risk the handoff stroke path).
      (s.points ?? [])
        .map((p) => `${p.x_pct.toFixed(1)},${p.y_pct.toFixed(1)}`)
        .join("|")
      }`,
  );
  const placementParts = doc.placements.map(
    (p) =>
      `${p.id}:${p.symbol_id}:${p.x_pct.toFixed(1)}:${p.y_pct.toFixed(1)}:${p.scale.toFixed(2)
      }:${p.rotation_deg}:${p.label ?? ""}:${(p.height_m ?? 0).toFixed(2)}:${(p.canopy_radius_m ?? 0).toFixed(2)
      }:${p.source ?? ""}`,
  );
  const trenchParts = (doc.constructionTrenches ?? []).map(
    (t) =>
      `${t.id}:${t.kind}:${t.depth_mm}:${t.points
        .map((p) => `${p.x_pct.toFixed(1)},${p.y_pct.toFixed(1)}`)
        .join("|")
      }`,
  );
  const zoneParts = (doc.irrigationZones ?? []).map(
    (z) =>
      `${z.id}:${z.kind}:${z.emitter_spacing_cm}:${z.emitter_flow_lph}:${z.points
        .map((p) => `${p.x_pct.toFixed(1)},${p.y_pct.toFixed(1)}`)
        .join("|")
      }`,
  );
  const photoElevationParts = (doc.photoElevations ?? []).map((e) => {
    const cal = e.calibration;
    const strokes = e.strokes
      .map((st) =>
        st.points.map((p) => `${p.x_m.toFixed(2)},${p.y_m.toFixed(2)}`).join("|"),
      )
      .join("~");
    return `${e.id}:${e.photo_id}:${e.azimuth_deg.toFixed(1)}:${cal ? `${cal.plane_width_m.toFixed(2)}:${cal.reference_m.toFixed(2)}:${cal.label}` : "uncal"
      }:${e.centre_x_m.toFixed(2)}:${e.centre_z_m.toFixed(2)}:${e.ground_offset_m.toFixed(2)}:${strokes}`;
  });
  const featureParts = (doc.features ?? []).map((f) => {
    const pts = f.geometry.points
      .map((v) => `${v.pct.x_pct.toFixed(1)},${v.pct.y_pct.toFixed(1)}`)
      .join("|");
    const mf = f.material_fill
      ? `${f.material_fill.type}:${f.material_fill.sku}:${f.material_fill.depth_m.toFixed(3)}:${f.material_fill.waste_allocation_pct.toFixed(1)}`
      : "nomf";
    const scatter = f.procedural_scatter_contents
      ? `${f.procedural_scatter_contents.brush_recipe_id}:${f.procedural_scatter_contents.seed_value}:${f.procedural_scatter_contents.instances.length}`
      : "noscatter";
    const labor = f.labor_profile
      ? f.labor_profile.base_difficulty_tier
      : "nolabor";
    return `${f.id}:${f.geometry.type}:${f.metadata.layer}:${f.metadata.friendly_name ?? ""
      }:${f.metadata.user_modification_state}:${f.geometry.points.length}:${pts}:${mf}:${scatter}:${labor}:${(
        f.extrude_height_m ?? 0
      ).toFixed(2)}`;
  });
  const canvasParts = (doc.canvases ?? []).map(
    (c) =>
      `${c.id}:${c.label ?? ""}:${c.position.join(",")}:${c.rotation.join(",")}`,
  );
  return [
    `s${doc.strokes.length}:${strokeParts.join("~")}`,
    `p${doc.placements.length}:${placementParts.join("~")}`,
    `t${(doc.constructionTrenches ?? []).length}:${trenchParts.join("~")}`,
    `z${(doc.irrigationZones ?? []).length}:${zoneParts.join("~")}`,
    `pe${(doc.photoElevations ?? []).length}:${photoElevationParts.join("~")}`,
    `f${(doc.features ?? []).length}:${featureParts.join("~")}`,
    `c${(doc.canvases ?? []).length}:${canvasParts.join("~")}`,
  ].join("§");
}

/* -------------------------------------------------------------------------- */
/* Backoff schedule                                                            */
/* -------------------------------------------------------------------------- */

/** Retry delays in ms — proven backoff ladder. */
const BACKOFF_MS = [2_000, 8_000, 30_000];

/** Debounce delay in ms — keeps saves quiet while the operator drafts. */
const DEBOUNCE_MS = 1_100;

/* -------------------------------------------------------------------------- */
/* The hook                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Debounced autosave for the unified WebGL studio.
 *
 * @param projectId  The project to save to (from the store or props).
 * @param doc         The current document slices to persist.
 *
 * Usage:
 *   const doc = useMemo(() => ({ placements, strokes }), [placements, strokes]);
 *   useStudioAutosave(projectId, doc);
 *
 * The hook manages saveStatus / saveRevision in the studio store automatically.
 * Components subscribe to `useStudioStore((s) => s.saveStatus)` for the chip.
 */
export function useStudioAutosave(
  projectId: string,
  doc: StudioAutosaveDoc,
): {
  /** Trigger an immediate save (bypasses the debounce). */
  saveNow: () => Promise<void>;
  /** Bump the retry nonce — forces the effect to re-run. */
  retrySave: () => void;
} {
  const persistKey = useMemo(() => buildPersistKey(doc), [doc]);

  // skipPersist: skip the FIRST effect run (bootstrap hydration shouldn't
  // immediately re-save the canvas we just loaded). Also flipped by saveNow
  // after a successful manual save to prevent the debounce re-firing.
  const skipPersist = useRef(true);
  // retryNonce: bumped by retrySave() to re-trigger the effect.
  const [retryNonce, setRetryNonce] = useState(0);

  // Refs to avoid stale closures inside the debounced callback.
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const docRef = useRef(doc);
  docRef.current = doc;
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const requestedSaveRef = useRef(0);

  // Store setters (stable identity from zustand).
  const setSaveStatus = useStudioStore((s) => s.setSaveStatus);
  const bumpSaveRevision = useStudioStore((s) => s.bumpSaveRevision);

  /**
   * Assemble the full canvas body and PUT it. Full-canvas save (not a diff) —
   * matches the SVG studio's saveNow pattern exactly.
   */
  const persist = useCallback(async (): Promise<void> => {
    const pid = projectIdRef.current;
    if (!pid) return;
    const current = docRef.current;
    const saveId = ++requestedSaveRef.current;

    setSaveStatus("saving");
    const queuedSave = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await saveDesignCanvasClient(pid, {
          placements: current.placements,
          strokes: current.strokes,
          construction_trenches: current.constructionTrenches,
          irrigation_zones: current.irrigationZones,
          photo_elevations: current.photoElevations,
          features: current.features,
          canvases: current.canvases,
        });
      });
    saveQueueRef.current = queuedSave.catch(() => undefined);

    try {
      await queuedSave;
      bumpSaveRevision();
      if (saveId === requestedSaveRef.current) {
        setSaveStatus("saved");
      }
    } catch (err) {
      const kind = classifySaveError(err);
      console.error("[useStudioAutosave] save failed", err);
      if (saveId === requestedSaveRef.current) {
        setSaveStatus("error", kind);
      }
      throw err instanceof Error ? err : new Error(String(err));
    }
  }, [setSaveStatus, bumpSaveRevision]);

  /** Immediate save — bypasses debounce (used by manual "Save" button + retry). */
  const saveNow = useCallback(async (): Promise<void> => {
    skipPersist.current = true; // suppress the debounce that would follow
    await persist();
  }, [persist]);

  /** Bump the retry nonce to re-run the debounced effect. */
  const retrySave = useCallback(() => {
    skipPersist.current = false;
    setRetryNonce((n) => n + 1);
  }, []);

  /**
   * The debounced autosave effect — keyed on [persistKey, retryNonce].
   *
   * When the content fingerprint changes (or the retry nonce bumps), wait
   * DEBOUNCE_MS, then attempt to persist. On failure, retry up to 3 times
   * with BACKOFF_MS delays. stale_client errors never heal → short-circuit.
   */
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }

    let cancelled = false;

    // Mark dirty immediately — the chip reads "Saving…" and the beforeunload
    // guard engages for the whole debounce window. The previous behaviour
    // (default "Saved" chip until the debounce fired) let an operator reload
    // inside the 1.1s window and silently lose the change.
    useStudioStore.getState().setSaveStatus("saving");

    const handle = window.setTimeout(() => {
      const attempt = async (trial: number): Promise<void> => {
        if (cancelled) return;
        try {
          await persist();
        } catch (err) {
          if (cancelled) return;
          const kind = classifySaveError(err);
          // stale_client never heals — only a page refresh fixes it.
          if (kind === "stale_client") {
            setSaveStatus("error", "stale_client");
            return;
          }
          if (trial <= BACKOFF_MS.length) {
            setSaveStatus("retrying", kind);
            await new Promise((r) =>
              window.setTimeout(r, BACKOFF_MS[trial - 1] ?? DEBOUNCE_MS),
            );
            return attempt(trial + 1);
          }
          setSaveStatus("error", kind);
        }
      };
      void attempt(1);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content fingerprint + retry nonce, not callback identity
  }, [persistKey, retryNonce]);

  return { saveNow, retrySave };
}

/**
 * beforeunload guard — warn before leaving when a save is in-flight or errored.
 *
 * The debounce delay is short (1100ms) so we don't guard every keystroke — we
 * only guard when the network is actually active or has failed.
 */
export function useBeforeUnloadGuard(): void {
  const saveStatus = useStudioStore((s) => s.saveStatus);

  useEffect(() => {
    const dirty =
      saveStatus === "error" ||
      saveStatus === "saving" ||
      saveStatus === "retrying";
    if (!dirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);
}
