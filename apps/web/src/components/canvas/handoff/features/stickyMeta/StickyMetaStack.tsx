"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import { buildServiceLedgerRows } from "../services/serviceLedger";
import type {
  ConstructionTrench,
  DesignBydaAsset,
  IrrigationZone,
} from "@workstream/contracts";
import type { SpotLevel, StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import type { GrowthStage } from "../../state/studioTypes";
import type { SunDatePreset } from "../sunGrowth/sunDatePreset";
import { buildEnvLiveMeta, type EnvWeatherDay } from "./envLiveMeta";
import { buildSiteLiveMeta } from "./siteLiveMeta";
import { buildTreesLiveMeta } from "./treesLiveMeta";
import { WeatherIcon } from "./WeatherIcon";
import { MetaIcon } from "./MetaIcon";
import {
  dismissStickyMeta,
  isStickyMetaDismissed,
  restoreStickyMeta,
  type StickyMetaCardId,
} from "./stickyMetaPrefs";
import css from "./stickyMeta.module.css";

type ActivePanel = "services" | "environment" | "site" | "trees" | null;

type Props = {
  projectId: string;
  visible: boolean;
  laneBusy: boolean;
  activePanel: ActivePanel;
  scaleM: number;
  boundary: PctPoint[];
  building: PctPoint[];
  services: PctPoint[][];
  easements: PctPoint[][];
  bydaAssets?: DesignBydaAsset[];
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
  /** Turf workable outdoor remnant (m²) for the site face cue. */
  outdoorM2?: number | null;
  /** Cadastral source label ("Vicmap") when the title boundary is known. */
  titleSource?: string | null;
  /** Today’s Open-Meteo day for weather icons (optional). */
  weatherDay?: EnvWeatherDay | null;
  /** Bump to re-read session dismiss prefs after restore. */
  restoreNonce?: number;
  onExpandServices: () => void;
  onExpandEnvironment: () => void;
  onExpandSite: () => void;
  onExpandTrees: () => void;
};

const ALL_CARDS: StickyMetaCardId[] = [
  "environment",
  "services",
  "site",
  "trees",
];

/**
 * Gold sticky meta stack — Cursor-style flush-right boundary rail with four
 * live faces: Environment, Services, Site, Trees. Persist until ×; expand
 * opens the matching right-lane detail panel on the same boundary seam.
 */
export function StickyMetaStack({
  projectId,
  visible,
  laneBusy,
  activePanel,
  scaleM,
  boundary,
  building,
  services,
  easements,
  bydaAssets = [],
  levels,
  irrigationZones,
  constructionTrenches,
  items,
  servicesLocked,
  sunMin,
  sunDatePreset,
  growth,
  shadeOn,
  lat,
  lng,
  outdoorM2 = null,
  titleSource = null,
  weatherDay = null,
  restoreNonce = 0,
  onExpandServices,
  onExpandEnvironment,
  onExpandSite,
  onExpandTrees,
}: Props) {
  const [dismissed, setDismissed] = useState<Record<StickyMetaCardId, boolean>>(
    {
      services: false,
      environment: false,
      site: false,
      trees: false,
    },
  );

  useEffect(() => {
    setDismissed({
      services: isStickyMetaDismissed(projectId, "services"),
      environment: isStickyMetaDismissed(projectId, "environment"),
      site: isStickyMetaDismissed(projectId, "site"),
      trees: isStickyMetaDismissed(projectId, "trees"),
    });
  }, [projectId, restoreNonce]);

  const serviceRows = useMemo(
    () =>
      buildServiceLedgerRows({
        services,
        easements,
        bydaAssets,
        levels,
        irrigationZones,
        constructionTrenches,
        items,
        scaleM,
      }),
    [
      services,
      easements,
      bydaAssets,
      levels,
      irrigationZones,
      constructionTrenches,
      items,
      scaleM,
    ],
  );

  const siteN = serviceRows.filter((r) => r.section === "site").length;
  const designN = serviceRows.filter((r) => r.section === "design").length;

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

  const site = useMemo(
    () =>
      buildSiteLiveMeta({
        boundary,
        building,
        easements,
        scaleM,
        lotAreaM2: null,
        titleSource,
      }),
    [boundary, building, easements, scaleM, titleSource],
  );

  const trees = useMemo(() => buildTreesLiveMeta({ items }), [items]);

  const siteDetail =
    outdoorM2 != null && outdoorM2 > 0
      ? `${site.detail} · ${Math.round(outdoorM2)} m² outdoor`
      : site.detail;

  if (!visible) return null;

  const anyVisible = ALL_CARDS.some((id) => !dismissed[id]);
  if (!anyVisible) return null;

  const dismiss = (id: StickyMetaCardId) => {
    dismissStickyMeta(projectId, id);
    setDismissed((d) => ({ ...d, [id]: true }));
  };

  return (
    <CameraChrome place={{ kind: "dock" }} zIndex={48} testId="sticky-meta-chrome">
      <div
        className={css.stack}
        data-testid="sticky-meta-stack"
        data-lane={laneBusy ? "busy" : "free"}
      >
        {!dismissed.environment ? (
          <MetaCard
            id="environment"
            testId="sticky-meta-environment"
            active={activePanel === "environment"}
            icon={<WeatherIcon condition={env.weatherCondition} size={18} />}
            face={env.face}
            detail={env.detail}
            onExpand={onExpandEnvironment}
            onDismiss={() => dismiss("environment")}
          />
        ) : null}

        {!dismissed.services ? (
          <MetaCard
            id="services"
            testId="sticky-meta-services"
            active={activePanel === "services"}
            icon={<MetaIcon id="services" size={18} />}
            face={
              <>
                Services · {siteN} site · {designN} design
                {servicesLocked ? (
                  <span className={css.badge}>locked</span>
                ) : null}
              </>
            }
            detail={
              siteN + designN === 0
                ? "Empty — Servc / Zone / Auto trench"
                : "Ticks · metrics · click to focus"
            }
            onExpand={onExpandServices}
            onDismiss={() => dismiss("services")}
          />
        ) : null}

        {!dismissed.site ? (
          <MetaCard
            id="site"
            testId="sticky-meta-site"
            active={activePanel === "site"}
            icon={<MetaIcon id="site" size={18} />}
            face={site.face}
            detail={siteDetail}
            onExpand={onExpandSite}
            onDismiss={() => dismiss("site")}
          />
        ) : null}

        {!dismissed.trees ? (
          <MetaCard
            id="trees"
            testId="sticky-meta-trees"
            active={activePanel === "trees"}
            icon={<MetaIcon id="trees" size={18} />}
            face={trees.face}
            detail={trees.detail}
            onExpand={onExpandTrees}
            onDismiss={() => dismiss("trees")}
          />
        ) : null}
      </div>
    </CameraChrome>
  );
}

function MetaCard({
  id,
  testId,
  active,
  icon,
  face,
  detail,
  onExpand,
  onDismiss,
}: {
  id: StickyMetaCardId;
  testId: string;
  active: boolean;
  icon: ReactNode;
  face: ReactNode;
  detail: ReactNode;
  onExpand: () => void;
  onDismiss: () => void;
}) {
  return (
    <button
      type="button"
      className={css.card}
      data-testid={testId}
      data-with-icon="true"
      data-active={active ? "true" : "false"}
      onClick={onExpand}
    >
      <span className={css.iconSlot}>{icon}</span>
      <p className={css.face}>{face}</p>
      <span
        className={css.close}
        role="button"
        tabIndex={0}
        aria-label={`Dismiss ${id} card`}
        data-testid={`${testId}-dismiss`}
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }
        }}
      >
        ×
      </span>
      <p className={css.detail}>{detail}</p>
    </button>
  );
}

/** Re-summon a dismissed sticky card (Cmd+K / header). */
export function summonStickyMeta(projectId: string, id: StickyMetaCardId) {
  restoreStickyMeta(projectId, id);
}
