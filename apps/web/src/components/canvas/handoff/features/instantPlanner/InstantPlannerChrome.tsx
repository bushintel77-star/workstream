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
import {
  HeroDetailOverlay,
  type HeroFeatureTarget,
} from "./HeroDetailOverlay";
import { HeroFeatureMarkers } from "./HeroFeatureMarkers";
import { LandscapeFeaturesLayer } from "./LandscapeFeaturesLayer";
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
  const [planFeatures, setPlanFeatures] = useState<LandscapeFeature[]>([]);
  const [hero, setHero] = useState<HeroFeatureTarget | null>(null);
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

  // Hydrate plan features from items when the studio board changes.
  useEffect(() => {
    if (!active) return;
    const fromItems = itemsToFeatures(items);
    setPlanFeatures((prev) => {
      const byId = new Map(prev.map((f) => [f.id, f]));
      for (const f of fromItems) byId.set(f.id, f);
      return [...byId.values()];
    });
  }, [active, items]);

  const canvas = useMemo((): DesignCanvas | null => {
    if (!active) return null;
    const fromItems = itemsToFeatures(items);
    const byId = new Set(fromItems.map((f) => f.id));
    return {
      id: "00000000-0000-4000-8000-000000000001",
      project_id: projectId,
      placements: itemsToPlacements(items),
      strokes: strokesToCanvas(strokes),
      irrigation_zones: irrigationZones ?? [],
      annotations: annotations ?? [],
      image_layers: imageLayers ?? [],
      features: [
        ...fromItems,
        ...planFeatures.filter((f) => !byId.has(f.id)),
      ],
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
    planFeatures,
  ]);

  if (!active) return null;

  const applyCanvas = (next: DesignCanvas) => {
    setPlanFeatures(next.features ?? []);
    onCanvasApplied(next);
  };

  const onApplyShadow = (alt: ShadowAlternative) => {
    startTransition(async () => {
      try {
        const res = await applyShadowAlternativeAction(projectId, alt.id);
        applyCanvas(res.canvas);
        const next = await getOrchestrationAction(projectId);
        setWorld(next);
      } catch {
        /* non-fatal */
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
      applyCanvas(res.canvas);
    });
  };

  return (
    <div className={css.layer} data-testid="instant-planner-chrome">
      <LandscapeFeaturesLayer features={planFeatures} paper={paper} />
      <HeroFeatureMarkers
        canvas={canvas}
        world={world}
        onOpen={setHero}
      />
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
        onCanvasSaved={applyCanvas}
      />
      <StructuredToolOverlay
        active={structuredTools}
        paper={paper}
        spatialFacts={world?.spatial_facts ?? []}
        onFeature={onStructuredFeature}
      />
      <HeroDetailOverlay feature={hero} onClose={() => setHero(null)} />
    </div>
  );
}
