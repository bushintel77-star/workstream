"use client";

import { useEffect, useMemo, useState } from "react";
import { CameraChrome } from "../../CameraChrome";
import { buildServiceLedgerRows } from "../services/serviceLedger";
import type { ConstructionTrench, IrrigationZone } from "@workstream/contracts";
import type { SpotLevel, StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import type { GrowthStage } from "../../state/studioTypes";
import type { SunDatePreset } from "../sunGrowth/sunDatePreset";
import { buildEnvLiveMeta, type EnvWeatherDay } from "./envLiveMeta";
import { WeatherIcon } from "./WeatherIcon";
import {
  dismissStickyMeta,
  isStickyMetaDismissed,
  restoreStickyMeta,
  type StickyMetaCardId,
} from "./stickyMetaPrefs";
import css from "./stickyMeta.module.css";

type Props = {
  projectId: string;
  visible: boolean;
  laneBusy: boolean;
  activePanel: "services" | "environment" | null;
  scaleM: number;
  services: PctPoint[][];
  easements: PctPoint[][];
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
  /** Today’s Open-Meteo day for weather icons (optional). */
  weatherDay?: EnvWeatherDay | null;
  /** Bump to re-read session dismiss prefs after restore. */
  restoreNonce?: number;
  onExpandServices: () => void;
  onExpandEnvironment: () => void;
};

/**
 * Gold sticky meta stack — translucent live cards for Env + Services.
 * Persist until ×; expand opens the right-lane detail panel.
 */
export function StickyMetaStack({
  projectId,
  visible,
  laneBusy,
  activePanel,
  scaleM,
  services,
  easements,
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
  weatherDay = null,
  restoreNonce = 0,
  onExpandServices,
  onExpandEnvironment,
}: Props) {
  const [dismissed, setDismissed] = useState<Record<StickyMetaCardId, boolean>>(
    {
      services: false,
      environment: false,
    },
  );

  useEffect(() => {
    setDismissed({
      services: isStickyMetaDismissed(projectId, "services"),
      environment: isStickyMetaDismissed(projectId, "environment"),
    });
  }, [projectId, restoreNonce]);

  const serviceRows = useMemo(
    () =>
      buildServiceLedgerRows({
        services,
        easements,
        levels,
        irrigationZones,
        constructionTrenches,
        items,
        scaleM,
      }),
    [
      services,
      easements,
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

  if (!visible) return null;

  const showEnv = !dismissed.environment;
  const showSvc = !dismissed.services;
  if (!showEnv && !showSvc) return null;

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
        {showEnv ? (
          <button
            type="button"
            className={css.card}
            data-testid="sticky-meta-environment"
            data-with-icon="true"
            data-active={activePanel === "environment" ? "true" : "false"}
            onClick={onExpandEnvironment}
          >
            <span className={css.iconSlot}>
              <WeatherIcon condition={env.weatherCondition} size={18} />
            </span>
            <p className={css.face}>{env.face}</p>
            <span
              className={css.close}
              role="button"
              tabIndex={0}
              aria-label="Dismiss environment card"
              data-testid="sticky-meta-environment-dismiss"
              onClick={(e) => {
                e.stopPropagation();
                dismiss("environment");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  dismiss("environment");
                }
              }}
            >
              ×
            </span>
            <p className={css.detail}>{env.detail}</p>
          </button>
        ) : null}

        {showSvc ? (
          <button
            type="button"
            className={css.card}
            data-testid="sticky-meta-services"
            data-active={activePanel === "services" ? "true" : "false"}
            onClick={onExpandServices}
          >
            <p className={css.face}>
              Services · {siteN} site · {designN} design
              {servicesLocked ? (
                <span className={css.badge}>locked</span>
              ) : null}
            </p>
            <span
              className={css.close}
              role="button"
              tabIndex={0}
              aria-label="Dismiss services card"
              data-testid="sticky-meta-services-dismiss"
              onClick={(e) => {
                e.stopPropagation();
                dismiss("services");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  dismiss("services");
                }
              }}
            >
              ×
            </span>
            <p className={css.detail}>
              {siteN + designN === 0
                ? "Empty — Servc / Zone / Auto trench"
                : "Ticks · metrics · click to focus"}
            </p>
          </button>
        ) : null}
      </div>
    </CameraChrome>
  );
}

/** Re-summon a dismissed sticky card (Cmd+K / header). */
export function summonStickyMeta(projectId: string, id: StickyMetaCardId) {
  restoreStickyMeta(projectId, id);
}
