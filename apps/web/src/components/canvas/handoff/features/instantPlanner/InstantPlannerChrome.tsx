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
import { CameraChrome } from "../../CameraChrome";
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
import { LeftoverAlertChip } from "./LeftoverAlertChip";
import { NextBestOptionChip } from "./NextBestOptionChip";
import {
  StudioAssistPanel,
  type StudioPackNavTarget,
} from "./StudioAssistPanel";
import { StructuredToolOverlay } from "./StructuredToolOverlay";
import css from "./instantPlanner.module.css";

type Props = {
  projectId: string;
  active: boolean;
  paper?: boolean;
  /** Mode allows structured tools — still summon-gated via structuredToolsOpen. */
  structuredTools?: boolean;
  /** Cmd+K summon — never parked on idle canvas. */
  assistOpen?: boolean;
  structuredToolsOpen?: boolean;
  onAssistOpenChange?: (open: boolean) => void;
  onStructuredToolsOpenChange?: (open: boolean) => void;
  /** Open design-branch dock after freeze (PDF §4.5 clarity). */
  onOpenBranches?: () => void;
  /** Presentation-pack checklist → canvas surfaces (PDF §4.9). */
  onStudioPackNav?: (target: StudioPackNavTarget) => void;
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
  assistOpen = false,
  structuredToolsOpen = false,
  onAssistOpenChange,
  onStructuredToolsOpenChange,
  onOpenBranches,
  onStudioPackNav,
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
  const [freezeBranchOk, setFreezeBranchOk] = useState(false);
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
    setPlanFeatures((prev) => {
      if (prev === landscapeFeatures) return prev;
      if (
        prev.length === landscapeFeatures.length &&
        prev.every((f, i) => f.id === landscapeFeatures[i]?.id)
      ) {
        return prev;
      }
      return landscapeFeatures;
    });
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
      photo_elevations: [],
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
    setFreezeBranchOk(false);
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
        setFreezeNote(
          "Client option frozen. Subsequent edits stay on the live tip; open Design branches to compare.",
        );
        setFreezeBranchOk(true);
        setHero(null);
      } catch (err) {
        setFreezeNote(
          err instanceof Error ? err.message : "Could not freeze option",
        );
        setFreezeBranchOk(false);
      }
    });
  };

  const showStructured = structuredTools && structuredToolsOpen;
  // Only mount a HUD chrome shell when something summoned/ephemeral is open.
  // Chips self-portal when they have content — never park an empty shell on
  // idle (that failed §6 item 1 / 1b / 5 as a full-board bar).
  const showSummonedHud =
    Boolean(freezeNote) || assistOpen || showStructured;

  return (
    <>
      {/* Plan geometry host (board space) — transparent, no hit steal. */}
      <div className={css.layer} data-testid="instant-planner-chrome">
        <LandscapeFeaturesLayer features={planFeatures} paper={paper} />
        <HeroFeatureMarkers
          canvas={canvas}
          world={world}
          onOpen={setHero}
        />
      </div>

      {/* Peripheral chips — each returns null (no CameraChrome) when idle. */}
      <NextBestOptionChip
        world={world}
        paper={paper}
        onApply={onApplyShadow}
      />
      <LeftoverAlertChip
        world={world}
        paper={paper}
        onOpenAssist={() => onAssistOpenChange?.(true)}
      />

      {/* Summoned assist / structured tools / freeze toast. */}
      {showSummonedHud ? (
        <CameraChrome
          place={{ kind: "dock" }}
          zIndex={36}
          testId="instant-planner-hud-chrome"
        >
          {assistOpen ? (
            <StudioAssistPanel
              projectId={projectId}
              world={world}
              canvas={canvas}
              paper={paper}
              onCanvasSaved={applyCanvas}
              onDismiss={() => onAssistOpenChange?.(false)}
              onStudioPackNav={onStudioPackNav}
            />
          ) : null}
          {showStructured ? (
            <StructuredToolOverlay
              active
              paper={paper}
              spatialFacts={world?.spatial_facts ?? []}
              onFeature={onStructuredFeature}
              onDismiss={() => onStructuredToolsOpenChange?.(false)}
            />
          ) : null}
          {freezeNote ? (
            <div
              className={css.toast}
              role="status"
              data-testid="instant-planner-freeze-toast"
            >
              <p className={css.toastText}>{freezeNote}</p>
              <div className={css.toastActions}>
                {freezeBranchOk && onOpenBranches ? (
                  <button
                    type="button"
                    className={css.toastBtn}
                    data-testid="instant-planner-view-branches"
                    onClick={() => {
                      onOpenBranches();
                      setFreezeNote(null);
                      setFreezeBranchOk(false);
                    }}
                  >
                    View branches
                  </button>
                ) : null}
                <button
                  type="button"
                  className={css.toastBtnGhost}
                  onClick={() => {
                    setFreezeNote(null);
                    setFreezeBranchOk(false);
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </CameraChrome>
      ) : null}

      {hero ? (
        <CameraChrome
          place={{ kind: "dock" }}
          zIndex={50}
          testId="hero-detail-chrome"
        >
          <HeroDetailOverlay
            feature={hero}
            onClose={() => setHero(null)}
            onFreeze={freezeClientOption}
          />
        </CameraChrome>
      ) : null}
    </>
  );
}
