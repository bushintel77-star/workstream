"use client";

import { useMemo } from "react";
import type {
  ConstructionTrench,
  DesignBydaAsset,
  DesignKeylessOverlay,
  IrrigationZone,
} from "@workstream/contracts";
import { CameraChrome } from "../../CameraChrome";
import type { SpotLevel, StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import type { GrowthStage } from "../../state/studioTypes";
import type { SunDatePreset } from "../sunGrowth/sunDatePreset";
import { buildEnvLiveMeta, type EnvWeatherDay } from "./envLiveMeta";
import { WeatherIcon } from "./WeatherIcon";
import {
  buildVicGovChipModels,
  type VicGovChipCluster,
  type VicGovChipId,
  type VicGovChipModel,
  type VicGovChipPanel,
} from "./vicGovChipStatus";
import css from "./vicGovChips.module.css";

type Props = {
  projectId: string;
  laneBusy: boolean;
  activePanel: VicGovChipPanel | "services" | null;
  scaleM: number;
  boundary: PctPoint[];
  building: PctPoint[];
  services: PctPoint[][];
  easements: PctPoint[][];
  bydaAssets?: DesignBydaAsset[];
  keylessOverlays?: DesignKeylessOverlay[];
  levels: SpotLevel[];
  irrigationZones: IrrigationZone[];
  constructionTrenches: ConstructionTrench[];
  items: StudioItem[];
  servicesLocked: boolean;
  sunMin: number;
  sunDatePreset: SunDatePreset;
  growth: GrowthStage;
  shadeOn: boolean;
  lat?: number | null;
  lng?: number | null;
  outdoorM2?: number | null;
  titleSource?: string | null;
  boundarySource?: "vicmap" | "manual" | "seed" | null;
  councilLabel?: string | null;
  councilHref?: string | null;
  sitePackChase?: Array<{ id: string; done: boolean }>;
  weatherDay?: EnvWeatherDay | null;
  onOpenPanel: (panel: Exclude<VicGovChipPanel, null>) => void;
  onCouncilLink?: (href: string) => void;
  /**
   * `dock` (default) — frost rail via CameraChrome (canvas-first).
   * `header` kept for tests / rare embeds; prefer dock.
   */
  placement?: "header" | "dock";
};

/**
 * Vic-gov status chip row — single panel of truth replacing stacked sticky cards.
 * Chip click opens the shared right-lane inspector (lane law).
 */
export function VicGovStatusChipRow({
  laneBusy,
  activePanel,
  boundary,
  easements,
  bydaAssets = [],
  keylessOverlays = [],
  items,
  sunMin,
  sunDatePreset,
  growth,
  shadeOn,
  lat,
  lng,
  titleSource = null,
  boundarySource = null,
  councilLabel = null,
  councilHref = null,
  sitePackChase = [],
  weatherDay = null,
  onOpenPanel,
  onCouncilLink,
  placement = "dock",
}: Props) {
  const env = useMemo(
    () =>
      buildEnvLiveMeta({
        sunMin,
        sunDatePreset,
        growth,
        lat,
        lng,
        shadeOn,
        weatherDay,
      }),
    [sunMin, sunDatePreset, growth, lat, lng, shadeOn, weatherDay],
  );

  const chips = useMemo(
    () =>
      buildVicGovChipModels({
        boundary,
        easements,
        keylessOverlays,
        items,
        bydaAssets,
        boundarySource,
        titleSource,
        councilLabel,
        councilHref,
        sitePackChase,
        envFace: env.face,
        shadeOn,
      }),
    [
      boundary,
      easements,
      keylessOverlays,
      items,
      bydaAssets,
      boundarySource,
      titleSource,
      councilLabel,
      councilHref,
      sitePackChase,
      env.face,
      shadeOn,
    ],
  );

  const activate = (id: VicGovChipId, panel: VicGovChipPanel, href?: string) => {
    if (id === "council" && href) {
      onCouncilLink?.(href);
      if (panel) onOpenPanel(panel);
      return;
    }
    if (panel) onOpenPanel(panel);
  };

  const renderChip = (chip: VicGovChipModel) => {
    const active = chip.panel != null && activePanel === chip.panel;
    return (
      <button
        key={chip.id}
        type="button"
        className={css.chip}
        data-testid={`vic-gov-chip-${chip.id}`}
        data-status={chip.tone}
        data-active={active ? "true" : "false"}
        aria-pressed={active}
        title={`${chip.label}: ${chip.face}`}
        onClick={() => activate(chip.id, chip.panel, chip.href)}
      >
        <span className={css.label}>
          {chip.id === "environment" ? (
            <WeatherIcon
              condition={env.weatherCondition}
              size={12}
              label={chip.label}
            />
          ) : null}
          {chip.label}
        </span>
        <span className={css.face}>{chip.face}</span>
      </button>
    );
  };

  const cluster = (id: VicGovChipCluster) =>
    chips.filter((chip) => chip.cluster === id);

  const clusterRow = (id: VicGovChipCluster, label: string) => {
    const group = cluster(id);
    if (group.length === 0) return null;
    return (
      <div
        className={`${css.row} ${css[id]}${placement === "header" ? ` ${css.rowHeader}` : ""}`}
        data-testid={`vic-gov-status-chips-${id}`}
        data-cluster={id}
        data-lane={laneBusy ? "busy" : "free"}
        data-placement={placement}
        role="toolbar"
        aria-label={label}
      >
        {group.map(renderChip)}
      </div>
    );
  };

  const clusters = (
    <>
      {clusterRow("title", "Site title and planning status")}
      {clusterRow("context", "Site context and authorities")}
    </>
  );

  if (placement === "header") return clusters;

  return (
    <CameraChrome place={{ kind: "dock" }} zIndex={48} testId="vic-gov-status-chrome">
      {clusters}
    </CameraChrome>
  );
}
