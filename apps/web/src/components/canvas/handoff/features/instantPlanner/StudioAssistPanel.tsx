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
} from "@workstream/domain";
import {
  listLeftoversAction,
  presentationPackAction,
  registerLeftoverAction,
  saveDesignCanvasAction,
} from "../../../../../app/actions";
import css from "./studioAssistPanel.module.css";

type Props = {
  projectId: string;
  world: ProjectOrchestrationWorld | null;
  canvas: DesignCanvas | null;
  paper?: boolean;
  onCanvasSaved?: (canvas: DesignCanvas) => void;
  /** Summoned panel — dismiss returns to idle canvas (no parked Assist chip). */
  onDismiss?: () => void;
};

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

export function StudioAssistPanel({
  projectId,
  world,
  canvas,
  paper,
  onCanvasSaved,
  onDismiss,
}: Props) {
  // Summoned via Cmd+K — panel open by default; Hide dismisses the summon.
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const [pool, setPool] = useState<LeftoverStock[]>([]);
  const [packNotes, setPackNotes] = useState<string[] | null>(null);
  const [poolNote, setPoolNote] = useState<string | null>(null);

  const lighting = useMemo(
    () => (world ? proposeLightingAssist(world.spatial_facts) : []),
    [world],
  );
  const leftoverHint = useMemo(
    () => matchLeftoversToBom(pool, world?.live_bom ?? []),
    [pool, world?.live_bom],
  );

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      try {
        const res = await listLeftoversAction();
        setPool(res.leftovers);
      } catch {
        setPool([]);
      }
    });
  }, [open]);

  if (!canvas) return null;

  const applyIrrigation = () => {
    startTransition(async () => {
      const softArea =
        world?.spatial_facts
          .filter((f) => f.layer === "softscape" || f.layer === "irrigation")
          .reduce((s, f) => s + f.area_m2, 0) ?? 90;
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
    });
  };

  const registerDemoLeftover = () => {
    startTransition(async () => {
      try {
        const row = await registerLeftoverAction({
          order_qty: 1,
          used_qty: 0.75,
          sku: "STONE-DEC",
          label: "Decorative stone",
          unit: "t",
          source_project_id: projectId,
        });
        setPool((prev) => [row, ...prev]);
        setPoolNote(`${row.qty} t ${row.label} available across jobs`);
      } catch {
        setPoolNote("Could not register leftover");
      }
    });
  };

  const runPresentationPack = () => {
    startTransition(async () => {
      try {
        const res = await presentationPackAction(projectId);
        setPackNotes(res.notes);
        if (res.brochure_uri) {
          window.open(res.brochure_uri, "_blank", "noopener,noreferrer");
        } else if (res.quote_uri) {
          window.open(res.quote_uri, "_blank", "noopener,noreferrer");
        }
      } catch {
        setPackNotes([
          "Presentation pack unavailable - finish design pipeline first.",
        ]);
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
          <p className={css.meta}>
            {lighting.length > 0
              ? `${lighting.length} uplights near trees`
              : "Place trees to unlock lighting assist"}
          </p>
          <p className={css.kicker}>Resource pool</p>
          <button
            type="button"
            className={css.btn}
            data-testid="assist-leftover"
            disabled={pending}
            onClick={registerDemoLeftover}
          >
            Register leftover stone
          </button>
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
