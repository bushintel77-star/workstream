"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  CatalogPlacement,
  DesignCanvas,
  IrrigationZone,
  LeftoverStock,
  ProjectOrchestrationWorld,
} from "@workstream/contracts";
import {
  assistLightingPlacementLabel,
  estimateIrrigationAssistLive,
  estimateLightingAssistLive,
  featureFromRecognizedStroke,
  listAssistIrrigationZones,
  listAssistLightingPlacements,
  matchLeftoversToBom,
  nudgeAssistLuminaires,
  proposeIrrigationAssist,
  proposeLightingAssist,
  recognizeStroke,
  scaleAssistPipeRuns,
  setAssistEmitterSpacing,
  SPACING_PRESETS_CM,
  summariseIrrigationAssist,
  summariseLightingAssist,
} from "@workstream/domain";
import {
  listLeftoversAction,
  presentationPackAction,
  saveDesignCanvasAction,
} from "../../../../../app/actions";
import type { PresentationPackChecklistItem } from "../../../../../lib/api";
import css from "./studioAssistPanel.module.css";

export type StudioPackNavTarget =
  | "sun-cast"
  | "elevations"
  | "freeze"
  | "supplier";

type Props = {
  projectId: string;
  world: ProjectOrchestrationWorld | null;
  canvas: DesignCanvas | null;
  paper?: boolean;
  onCanvasSaved?: (canvas: DesignCanvas) => void;
  /** Summoned panel — dismiss returns to idle canvas (no parked Assist chip). */
  onDismiss?: () => void;
  /** Canvas-native pack checklist links (PDF §4.9 — no fake brochure). */
  onStudioPackNav?: (target: StudioPackNavTarget) => void;
};

function isStudioPackNavId(id: string): id is StudioPackNavTarget {
  return (
    id === "sun-cast" ||
    id === "elevations" ||
    id === "freeze" ||
    id === "supplier"
  );
}

/** Relative /projects/… deep links stay in-studio; absolute output HTML opens externally. */
function isStudioRelativeUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return uri.startsWith("/projects/");
}

async function persistCanvas(
  projectId: string,
  canvas: DesignCanvas,
  patch: Partial<DesignCanvas>,
) {
  return saveDesignCanvasAction(
    projectId,
    patch.placements ?? canvas.placements,
    patch.strokes ?? canvas.strokes ?? [],
    patch.irrigation_zones ?? canvas.irrigation_zones ?? [],
    patch.annotations ?? canvas.annotations,
    patch.image_layers ?? canvas.image_layers,
    patch.site_frame ?? canvas.site_frame,
    patch.features ?? canvas.features,
    patch.construction_trenches ?? canvas.construction_trenches,
  );
}

function checklistStatusLabel(
  status: PresentationPackChecklistItem["status"],
): string {
  switch (status) {
    case "generated":
      return "Generated";
    case "ready":
      return "Ready";
    case "studio":
      return "On canvas";
    case "skipped":
      return "Skipped";
    default:
      return status;
  }
}

export function StudioAssistPanel({
  projectId,
  world,
  canvas,
  paper,
  onCanvasSaved,
  onDismiss,
  onStudioPackNav,
}: Props) {
  // Summoned via Cmd+K — panel open by default; Hide dismisses the summon.
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const [pool, setPool] = useState<LeftoverStock[]>([]);
  const [packNotes, setPackNotes] = useState<string[] | null>(null);
  const [packChecklist, setPackChecklist] = useState<
    PresentationPackChecklistItem[] | null
  >(null);
  const [packLinks, setPackLinks] = useState<{
    brochure: string | null;
    quote: string | null;
    schedule: string | null;
    supplier: string | null;
  } | null>(null);
  const [poolNote, setPoolNote] = useState<string | null>(null);
  const [assistMetric, setAssistMetric] = useState<string | null>(null);
  /** Draft assist irrigation for live coverage/cost editing after place. */
  const [draftZones, setDraftZones] = useState<IrrigationZone[] | null>(null);
  /** Draft assist luminaires for live position editing after place. */
  const [draftLights, setDraftLights] = useState<CatalogPlacement[] | null>(
    null,
  );

  const softArea = useMemo(() => {
    return (
      world?.spatial_facts
        .filter((f) => f.layer === "softscape" || f.layer === "irrigation")
        .reduce((s, f) => s + f.area_m2, 0) ?? 90
    );
  }, [world]);

  const boardWidthM =
    canvas?.site_frame?.board_width_m && canvas.site_frame.board_width_m > 0
      ? canvas.site_frame.board_width_m
      : 20;

  const lighting = useMemo(
    () => (world ? proposeLightingAssist(world.spatial_facts) : []),
    [world],
  );
  const irrigationPreview = useMemo(
    () => proposeIrrigationAssist({ openAreaM2: softArea }),
    [softArea],
  );
  const irrigationSummary = useMemo(
    () => summariseIrrigationAssist(irrigationPreview, softArea),
    [irrigationPreview, softArea],
  );
  const lightingSummary = useMemo(
    () => summariseLightingAssist(lighting),
    [lighting],
  );
  const leftoverHint = useMemo(
    () => matchLeftoversToBom(pool, world?.live_bom ?? []),
    [pool, world?.live_bom],
  );

  const canvasAssistZones = useMemo(
    () => listAssistIrrigationZones(canvas?.irrigation_zones ?? []),
    [canvas?.irrigation_zones],
  );
  const canvasAssistLights = useMemo(
    () => listAssistLightingPlacements(canvas?.placements ?? []),
    [canvas?.placements],
  );

  // Sync drafts from canvas when assist layers appear / change externally.
  useEffect(() => {
    if (canvasAssistZones.length === 0) {
      setDraftZones(null);
      return;
    }
    setDraftZones(canvasAssistZones);
  }, [canvasAssistZones]);

  useEffect(() => {
    if (canvasAssistLights.length === 0) {
      setDraftLights(null);
      return;
    }
    setDraftLights(canvasAssistLights);
  }, [canvasAssistLights]);

  const liveIrrigation = useMemo(() => {
    if (!draftZones || draftZones.length === 0) return null;
    return estimateIrrigationAssistLive(draftZones, softArea, boardWidthM);
  }, [draftZones, softArea, boardWidthM]);

  const liveLighting = useMemo(() => {
    if (!draftLights || draftLights.length === 0) return null;
    return estimateLightingAssistLive(draftLights, boardWidthM);
  }, [draftLights, boardWidthM]);

  const meanSpacingCm = useMemo(() => {
    if (!draftZones || draftZones.length === 0) return 30;
    const spacings = draftZones
      .map((z) => z.emitter_spacing_cm)
      .filter((n): n is number => typeof n === "number" && n > 0);
    if (spacings.length === 0) return 30;
    return Math.round(
      spacings.reduce((s, n) => s + n, 0) / spacings.length,
    );
  }, [draftZones]);

  useEffect(() => {
    if (!open) return;
    // Do not use useTransition here — that shared `pending` disables every
    // Assist CTA (including Generate presentation pack) while leftovers load.
    let cancelled = false;
    void (async () => {
      try {
        const res = await listLeftoversAction();
        if (!cancelled) setPool(res.leftovers);
      } catch {
        if (!cancelled) setPool([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!canvas) return null;

  const mergeAssistZones = (assist: IrrigationZone[]): IrrigationZone[] => {
    const kept = (canvas.irrigation_zones ?? []).filter(
      (z) =>
        !z.name.toLowerCase().includes("drip zone") &&
        !z.name.toLowerCase().startsWith("assist:"),
    );
    return [...kept, ...assist];
  };

  const mergeAssistLights = (
    assist: CatalogPlacement[],
  ): CatalogPlacement[] => {
    const kept = canvas.placements.filter(
      (p) => !listAssistLightingPlacements([p]).length,
    );
    return [...kept, ...assist];
  };

  const applyIrrigation = () => {
    startTransition(async () => {
      const zones: IrrigationZone[] = proposeIrrigationAssist({
        openAreaM2: softArea,
      });
      const tagged = zones.map((z) => ({
        ...z,
        name: z.name.startsWith("Assist:") ? z.name : `Assist: ${z.name}`,
      }));
      const nextZones = mergeAssistZones(tagged);
      const res = await persistCanvas(projectId, canvas, {
        irrigation_zones: nextZones,
      });
      onCanvasSaved?.(res.canvas);
      setDraftZones(tagged);
      const live = estimateIrrigationAssistLive(tagged, softArea, boardWidthM);
      setAssistMetric(
        `Irrigation placed — ${live.label}. Tune spacing and pipe runs below.`,
      );
    });
  };

  const convertStrokes = () => {
    const strokes = canvas.strokes ?? [];
    if (strokes.length === 0) {
      setPoolNote("No freehand strokes to convert - draw markup first.");
      return;
    }
    startTransition(async () => {
      const nextFeatures = [...(canvas.features ?? [])];
      let converted = 0;
      for (const stroke of strokes) {
        const rec = recognizeStroke(stroke);
        if (!rec || rec.confidence < 0.55) continue;
        nextFeatures.push(featureFromRecognizedStroke(stroke, rec));
        converted += 1;
      }
      if (converted === 0) {
        setPoolNote("No strokes recognised as ditch/path/wall/bed.");
        return;
      }
      const res = await persistCanvas(projectId, canvas, {
        features: nextFeatures,
      });
      onCanvasSaved?.(res.canvas);
      setPoolNote(`Converted ${converted} stroke(s) to CAD features.`);
    });
  };

  const applyLighting = () => {
    if (lighting.length === 0) return;
    startTransition(async () => {
      const assistPlacements: CatalogPlacement[] = lighting.flatMap((l) => {
        const count = Math.max(1, l.count || 1);
        return Array.from({ length: count }, (_, i) => ({
          id: crypto.randomUUID(),
          symbol_id: "path-light",
          x_pct: Math.min(98, l.x_pct + i * 1.5),
          y_pct: Math.min(98, l.y_pct + i * 0.8),
          rotation_deg: 0,
          scale: 1,
          label: assistLightingPlacementLabel(l.fixture),
        }));
      });
      const kept = canvas.placements.filter(
        (p) => !listAssistLightingPlacements([p]).length,
      );
      const placements = [...kept, ...assistPlacements];
      const res = await persistCanvas(projectId, canvas, { placements });
      onCanvasSaved?.(res.canvas);
      setDraftLights(assistPlacements);
      const live = estimateLightingAssistLive(assistPlacements, boardWidthM);
      setAssistMetric(
        `Lighting placed — ${live.label}. Nudge luminaires below; cost updates live.`,
      );
    });
  };

  const persistIrrigationDraft = (nextAssist: IrrigationZone[]) => {
    setDraftZones(nextAssist);
    const live = estimateIrrigationAssistLive(
      nextAssist,
      softArea,
      boardWidthM,
    );
    setAssistMetric(`Irrigation edit — ${live.label}`);
    startTransition(async () => {
      const res = await persistCanvas(projectId, canvas, {
        irrigation_zones: mergeAssistZones(nextAssist),
      });
      onCanvasSaved?.(res.canvas);
    });
  };

  const persistLightingDraft = (nextAssist: CatalogPlacement[]) => {
    setDraftLights(nextAssist);
    const live = estimateLightingAssistLive(nextAssist, boardWidthM);
    setAssistMetric(`Lighting edit — ${live.label}`);
    startTransition(async () => {
      const res = await persistCanvas(projectId, canvas, {
        placements: mergeAssistLights(nextAssist),
      });
      onCanvasSaved?.(res.canvas);
    });
  };

  const onSpacing = (cm: number) => {
    if (!draftZones) return;
    persistIrrigationDraft(setAssistEmitterSpacing(draftZones, cm));
  };

  const onPipeScale = (factor: number) => {
    if (!draftZones) return;
    persistIrrigationDraft(scaleAssistPipeRuns(draftZones, factor));
  };

  const onNudgeLights = (dx: number, dy: number) => {
    if (!draftLights) return;
    persistLightingDraft(nudgeAssistLuminaires(draftLights, dx, dy));
  };

  const runPresentationPack = () => {
    startTransition(async () => {
      try {
        const res = await presentationPackAction(projectId);
        setPackNotes(res.notes);
        setPackChecklist(res.checklist ?? []);
        setPackLinks({
          brochure: res.brochure_uri,
          quote: res.quote_uri,
          schedule: res.schedule_uri ?? null,
          supplier: res.supplier_uri ?? null,
        });
        const openUri =
          res.brochure_uri ||
          res.quote_uri ||
          res.schedule_uri ||
          res.supplier_uri ||
          null;
        if (openUri && /^https?:\/\//i.test(openUri)) {
          window.open(openUri, "_blank", "noopener,noreferrer");
        }
      } catch {
        setPackNotes([
          "Presentation pack unavailable - finish design pipeline first.",
        ]);
        setPackChecklist(null);
        setPackLinks(null);
      }
    });
  };

  return (
    <div
      className={`${css.wrap}${paper ? ` ${css.paper}` : ""}`}
      data-testid="studio-assist-panel"
    >
      <button
        type="button"
        className={css.toggle}
        aria-expanded={open}
        onClick={() => {
          if (open) {
            setOpen(false);
            onDismiss?.();
          } else {
            setOpen(true);
          }
        }}
      >
        {open ? "Hide assist" : "Assist"}
      </button>
      {open ? (
        <div className={css.panel}>
          <p className={css.kicker}>Sketch to CAD</p>
          <button
            type="button"
            className={css.btn}
            disabled={pending}
            data-testid="assist-convert-strokes"
            onClick={convertStrokes}
          >
            Convert freehand strokes
          </button>
          <p className={css.kicker}>Irrigation and lighting</p>
          <p className={css.meta} data-testid="assist-irrigation-preview">
            Preview: {irrigationSummary.label}
          </p>
          <button
            type="button"
            className={css.btn}
            disabled={pending}
            data-testid="assist-irrigation"
            onClick={applyIrrigation}
          >
            First-pass irrigation
          </button>
          <button
            type="button"
            className={css.btn}
            disabled={pending || lighting.length === 0}
            data-testid="assist-lighting"
            onClick={applyLighting}
          >
            Place lighting assist ({lighting.length})
          </button>
          <p className={css.meta} data-testid="assist-lighting-preview">
            {lighting.length > 0
              ? `Preview: ${lightingSummary.label}`
              : "Place trees to unlock lighting assist"}
          </p>
          {assistMetric ? (
            <p className={css.chip} data-testid="assist-metric-chip">
              {assistMetric}
            </p>
          ) : null}
          {liveIrrigation ? (
            <div
              className={css.editBlock}
              data-testid="assist-irrigation-edit"
            >
              <p className={css.kicker}>Edit irrigation coverage</p>
              <p className={css.live} data-testid="assist-irrigation-live">
                {liveIrrigation.label}
              </p>
              <p className={css.meta}>
                {liveIrrigation.pipe_m} m pipe · {liveIrrigation.emitters}{" "}
                emitters · {liveIrrigation.flow_lph} L/h
              </p>
              <p className={css.meta}>Emitter spacing (cm)</p>
              <div className={css.chipRow} role="group" aria-label="Emitter spacing">
                {SPACING_PRESETS_CM.map((cm) => (
                  <button
                    key={cm}
                    type="button"
                    className={
                      meanSpacingCm === cm ? css.chipBtnActive : css.chipBtn
                    }
                    disabled={pending}
                    data-testid={`assist-spacing-${cm}`}
                    onClick={() => onSpacing(cm)}
                  >
                    {cm}
                  </button>
                ))}
              </div>
              <p className={css.meta}>Pipe runs</p>
              <div className={css.chipRow}>
                <button
                  type="button"
                  className={css.chipBtn}
                  disabled={pending}
                  data-testid="assist-pipe-shorter"
                  onClick={() => onPipeScale(0.9)}
                >
                  Shorter
                </button>
                <button
                  type="button"
                  className={css.chipBtn}
                  disabled={pending}
                  data-testid="assist-pipe-longer"
                  onClick={() => onPipeScale(1.1)}
                >
                  Longer
                </button>
              </div>
            </div>
          ) : null}
          {liveLighting ? (
            <div className={css.editBlock} data-testid="assist-lighting-edit">
              <p className={css.kicker}>Edit lighting positions</p>
              <p className={css.live} data-testid="assist-lighting-live">
                {liveLighting.label}
              </p>
              <p className={css.meta}>Nudge luminaires</p>
              <div className={css.nudgeGrid}>
                <span />
                <button
                  type="button"
                  className={css.chipBtn}
                  disabled={pending}
                  data-testid="assist-light-nudge-n"
                  onClick={() => onNudgeLights(0, -1.5)}
                >
                  N
                </button>
                <span />
                <button
                  type="button"
                  className={css.chipBtn}
                  disabled={pending}
                  data-testid="assist-light-nudge-w"
                  onClick={() => onNudgeLights(-1.5, 0)}
                >
                  W
                </button>
                <button
                  type="button"
                  className={css.chipBtn}
                  disabled={pending}
                  data-testid="assist-light-nudge-s"
                  onClick={() => onNudgeLights(0, 1.5)}
                >
                  S
                </button>
                <button
                  type="button"
                  className={css.chipBtn}
                  disabled={pending}
                  data-testid="assist-light-nudge-e"
                  onClick={() => onNudgeLights(1.5, 0)}
                >
                  E
                </button>
              </div>
            </div>
          ) : null}
          <p className={css.kicker}>Resource pool</p>
          <p className={css.meta} data-testid="assist-leftover">
            Pack leftovers register automatically when you Add to Main Quote
            (bulk stone, base, mulch, sand).
          </p>
          {poolNote ? <p className={css.meta}>{poolNote}</p> : null}
          {leftoverHint ? (
            <p className={css.chip} data-testid="leftover-chip">
              Use leftover {leftoverHint.cover_qty} {leftoverHint.leftover.unit}{" "}
              {leftoverHint.leftover.label} on {leftoverHint.bom_line.label}
            </p>
          ) : null}
          <p className={css.kicker}>Presentation</p>
          <button
            type="button"
            className={css.btn}
            disabled={pending}
            data-testid="assist-presentation-pack"
            onClick={runPresentationPack}
          >
            Generate presentation pack
          </button>
          {packLinks ? (
            <div className={css.packLinks} data-testid="assist-pack-links">
              {packLinks.brochure ? (
                <a
                  className={css.link}
                  href={packLinks.brochure}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open brochure
                </a>
              ) : null}
              {packLinks.quote ? (
                <a
                  className={css.link}
                  href={packLinks.quote}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open quote
                </a>
              ) : null}
              {packLinks.schedule ? (
                <a
                  className={css.link}
                  href={packLinks.schedule}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open plant schedule
                </a>
              ) : null}
              {packLinks.supplier ? (
                <a
                  className={css.link}
                  href={packLinks.supplier}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="assist-pack-link-supplier"
                >
                  Open supplier order
                </a>
              ) : null}
            </div>
          ) : null}
          {packChecklist && packChecklist.length > 0 ? (
            <ul className={css.checklist} data-testid="assist-pack-checklist">
              {packChecklist.map((item) => {
                const external =
                  Boolean(item.uri) && /^https?:\/\//i.test(item.uri ?? "");
                const studioNav =
                  isStudioPackNavId(item.id) &&
                  Boolean(onStudioPackNav) &&
                  (item.status === "ready" || item.status === "studio") &&
                  (isStudioRelativeUri(item.uri) || !item.uri);
                return (
                  <li
                    key={item.id}
                    data-status={item.status}
                    data-testid={`assist-pack-item-${item.id}`}
                    title={item.reason ?? undefined}
                  >
                    {studioNav ? (
                      <button
                        type="button"
                        className={css.checkLink}
                        data-testid={`assist-pack-open-${item.id}`}
                        onClick={() =>
                          onStudioPackNav?.(item.id as StudioPackNavTarget)
                        }
                      >
                        {item.label}
                      </button>
                    ) : external ? (
                      <a
                        className={css.checkLink}
                        href={item.uri!}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`assist-pack-open-${item.id}`}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <span>{item.label}</span>
                    )}
                    <span className={css.checkStatus}>
                      {checklistStatusLabel(item.status)}
                    </span>
                    {item.reason && item.status === "skipped" ? (
                      <span
                        className={css.checkReason}
                        data-testid={`assist-pack-reason-${item.id}`}
                      >
                        {item.reason}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {packNotes
            ? packNotes.map((n) => (
              <p key={n} className={css.meta}>
                {n}
              </p>
            ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
