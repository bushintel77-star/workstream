"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

/**
 * A corner chip cluster. Capped by `max-width` and horizontally scrollable with
 * the scrollbar hidden, so it publishes its own overflow state as data attributes:
 * the stylesheet fades the trailing edge only while there is more to reach.
 * Without this the tail chip is cut mid-word with no signal that it continues.
 */
function ChipCluster({
  className,
  testId,
  cluster,
  lane,
  placement,
  label,
  children,
}: {
  className: string;
  testId: string;
  cluster: VicGovChipCluster;
  lane: "busy" | "free";
  placement: "header" | "dock";
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const slack = el.scrollWidth - el.clientWidth;
    const over = slack > 1;
    setOverflow(over);
    setAtEnd(!over || el.scrollLeft >= slack - 1);
  }, []);

  // Chip content changes on nearly every studio tick; re-measuring per render is
  // two layout reads and keeps the flag honest without a dependency list that
  // would thrash the observer.
  useEffect(measure);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  return (
    <div
      ref={ref}
      className={className}
      data-testid={testId}
      data-cluster={cluster}
      data-lane={lane}
      data-placement={placement}
      data-overflow={overflow ? "true" : "false"}
      data-scroll-end={atEnd ? "true" : "false"}
      role="toolbar"
      aria-label={label}
    >
      {children}
    </div>
  );
}

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
      <ChipCluster
        className={`${css.row} ${css[id]}${placement === "header" ? ` ${css.rowHeader}` : ""}`}
        testId={`vic-gov-status-chips-${id}`}
        cluster={id}
        lane={laneBusy ? "busy" : "free"}
        placement={placement}
        label={label}
      >
        {group.map(renderChip)}
      </ChipCluster>
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
