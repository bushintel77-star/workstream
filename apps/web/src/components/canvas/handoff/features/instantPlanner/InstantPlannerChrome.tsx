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
  mergeCanvasFeatures,
  strokesToCanvas,
  itemsToPlacements,
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
  landscapeFeatures?: LandscapeFeature[];
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
  landscapeFeatures = [],
  onCanvasApplied,
}: Props) {
  const [world, setWorld] = useState<ProjectOrchestrationWorld | null>(null);
  const [planFeatures, setPlanFeatures] = useState<LandscapeFeature[]>(
    landscapeFeatures,
  );
  const [hero, setHero] = useState<HeroFeatureTarget | null>(null);
  const [freezeNote, setFreezeNote] = useState<string | null>(null);
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

  // Keep chrome features aligned with studio snapshot (load / checkout / save).
  useEffect(() => {
    if (!active) return;
    setPlanFeatures(landscapeFeatures);
  }, [active, landscapeFeatures]);

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
      features: mergeCanvasFeatures(itemsToFeatures(items), planFeatures),
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

  const freezeClientOption = () => {
    setFreezeNote(null);
    startTransition(async () => {
      const stamp = new Date().toLocaleString("en-AU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      try {
        const res = await fetch(`/api/projects/${projectId}/design-branches`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: `Option — ${stamp}` }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || "Freeze failed");
        }
        setFreezeNote("Client option frozen as a design branch.");
        setHero(null);
      } catch (err) {
        setFreezeNote(
          err instanceof Error ? err.message : "Could not freeze option",
        );
      }
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
      <HeroDetailOverlay
        feature={hero}
        onClose={() => setHero(null)}
        onFreeze={freezeClientOption}
      />
      {freezeNote ? (
        <p className={css.toast} role="status">
          {freezeNote}
        </p>
      ) : null}
    </div>
  );
}
