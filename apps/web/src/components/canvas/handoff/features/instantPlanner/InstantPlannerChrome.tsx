"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  DesignCanvas,
  LandscapeFeature,
  ProjectOrchestrationWorld,
} from "@workstream/contracts";
import type { ShadowAlternative } from "@workstream/domain";
import {
  applyShadowAlternativeAction,
  getOrchestrationAction,
  saveDesignCanvasAction,
} from "../../../../../app/actions";
import {
  itemsToFeatures,
  itemsToPlacements,
  strokesToCanvas,
} from "../../state/canvasBridge";
import type { SketchStroke, StudioItem } from "../../studioCatalog";
import { NextBestOptionChip } from "./NextBestOptionChip";
import { StudioAssistPanel } from "./StudioAssistPanel";
import { StructuredToolOverlay } from "./StructuredToolOverlay";
import css from "./instantPlanner.module.css";

type Props = {
  projectId: string;
  active: boolean;
  paper?: boolean;
  structuredTools?: boolean;
  items: StudioItem[];
  strokes: SketchStroke[];
  irrigationZones: DesignCanvas["irrigation_zones"];
  annotations: DesignCanvas["annotations"];
  imageLayers: DesignCanvas["image_layers"];
  constructionTrenches: DesignCanvas["construction_trenches"];
  onCanvasApplied: (canvas: DesignCanvas) => void;
};

export function InstantPlannerChrome({
  projectId,
  active,
  paper = true,
  structuredTools = false,
  items,
  strokes,
  irrigationZones,
  annotations,
  imageLayers,
  constructionTrenches,
  onCanvasApplied,
}: Props) {
  const [world, setWorld] = useState<ProjectOrchestrationWorld | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const res = await getOrchestrationAction(projectId);
        if (!cancelled) setWorld(res);
      } catch {
        if (!cancelled) setWorld(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active, projectId]);

  const canvas = useMemo((): DesignCanvas | null => {
    if (!active) return null;
    return {
      id: "00000000-0000-4000-8000-000000000001",
      project_id: projectId,
      placements: itemsToPlacements(items),
      strokes: strokesToCanvas(strokes),
      irrigation_zones: irrigationZones ?? [],
      annotations: annotations ?? [],
      image_layers: imageLayers ?? [],
      features: itemsToFeatures(items),
      construction_trenches: constructionTrenches ?? [],
      updated_at: new Date().toISOString(),
    };
  }, [
    active,
    projectId,
    items,
    strokes,
    irrigationZones,
    annotations,
    imageLayers,
    constructionTrenches,
  ]);

  if (!active) return null;

  const onApplyShadow = (alt: ShadowAlternative) => {
    startTransition(async () => {
      try {
        const res = await applyShadowAlternativeAction(projectId, alt.id);
        onCanvasApplied(res.canvas);
        const next = await getOrchestrationAction(projectId);
        setWorld(next);
      } catch {
        /* toast via assist reply path elsewhere if needed */
      }
    });
  };

  const onStructuredFeature = (feature: LandscapeFeature) => {
    if (!canvas) return;
    startTransition(async () => {
      const res = await saveDesignCanvasAction(
        projectId,
        canvas.placements,
        canvas.strokes ?? [],
        canvas.irrigation_zones ?? [],
        canvas.annotations,
        canvas.image_layers,
        canvas.site_frame,
        [...(canvas.features ?? []), feature],
        canvas.construction_trenches,
      );
      onCanvasApplied(res.canvas);
    });
  };

  return (
    <div className={css.layer} data-testid="instant-planner-chrome">
      <NextBestOptionChip
        world={world}
        paper={paper}
        onApply={onApplyShadow}
      />
      <StudioAssistPanel
        projectId={projectId}
        world={world}
        canvas={canvas}
        paper={paper}
        onCanvasSaved={onCanvasApplied}
      />
      <StructuredToolOverlay
        active={structuredTools}
        paper={paper}
        spatialFacts={world?.spatial_facts ?? []}
        onFeature={onStructuredFeature}
      />
    </div>
  );
}
