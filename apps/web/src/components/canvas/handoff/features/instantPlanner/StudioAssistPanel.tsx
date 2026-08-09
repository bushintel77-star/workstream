"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  DesignCanvas,
  IrrigationZone,
  LeftoverStock,
  ProjectOrchestrationWorld,
} from "@workstream/contracts";
import {
  featureFromRecognizedStroke,
  matchLeftoversToBom,
  proposeIrrigationAssist,
  proposeLightingAssist,
  recognizeStroke,
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

  const softArea = useMemo(() => {
    return (
      world?.spatial_facts
        .filter((f) => f.layer === "softscape" || f.layer === "irrigation")
        .reduce((s, f) => s + f.area_m2, 0) ?? 90
    );
  }, [world]);

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

  const applyIrrigation = () => {
    startTransition(async () => {
      const zones: IrrigationZone[] = proposeIrrigationAssist({
        openAreaM2: softArea,
      });
      const kept = (canvas.irrigation_zones ?? []).filter(
        (z) =>
          !z.name.toLowerCase().includes("drip zone") &&
          !z.name.toLowerCase().startsWith("assist:"),
      );
      const tagged = zones.map((z) => ({
        ...z,
        name: z.name.startsWith("Assist:") ? z.name : `Assist: ${z.name}`,
      }));
      const res = await persistCanvas(projectId, canvas, {
        irrigation_zones: [...kept, ...tagged],
      });
      onCanvasSaved?.(res.canvas);
      setAssistMetric(
        `Irrigation placed — ${summariseIrrigationAssist(tagged, softArea).label}. Adjust emitters on the layer; cost updates with the live estimator.`,
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
      const placements = [
        ...canvas.placements,
        ...lighting.map((l) => ({
          id: crypto.randomUUID(),
          symbol_id: "path-light",
          x_pct: l.x_pct,
          y_pct: l.y_pct,
          rotation_deg: 0,
          scale: 1,
          label: l.fixture,
        })),
      ];
      const res = await persistCanvas(projectId, canvas, { placements });
      onCanvasSaved?.(res.canvas);
      setAssistMetric(
        `Lighting placed — ${lightingSummary.label}. Move fixtures freely; Instant Planner reflects coverage cost.`,
      );
    });
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
