import Link from "next/link";
import type { SiteContext, Survey } from "../lib/api";
import { ProjectTitleCover } from "./ProjectTitleCover";
import { SiteContextRibbon } from "./SiteContextRibbon";
import { SitePlanMapSvg } from "./SitePlanMapSvg";
import t from "./project-title-site-map.module.css";

export function ProjectTitleSiteMap({
  survey,
  address,
  siteContext,
  kicker = "Landscape project",
  designHref,
}: {
  survey: Survey;
  address: string;
  siteContext?: SiteContext | null;
  kicker?: string;
  designHref?: string;
}) {
  const sunMarker = siteContext
    ? {
        x_pct: siteContext.sun.marker_x_pct,
        y_pct: siteContext.sun.marker_y_pct,
        azimuth_label: siteContext.sun.now_azimuth_label,
        altitude_deg: siteContext.sun.now_altitude_deg,
      }
    : undefined;

  return (
    <div
      className={t.cover}
      role="img"
      aria-label={`${kicker}: ${address}. Backyard ${Math.round(survey.garden_area_m2)} square metres mapped.`}
    >
      <div className={t.grid} aria-hidden />
      {siteContext ? <SiteContextRibbon context={siteContext} /> : null}
      <div className={t.mapLayer}>
        <SitePlanMapSvg
          survey={survey}
          showEdgeLabels={false}
          sunMarker={sunMarker}
        />
      </div>
      <span className={t.badge}>Backyard mapped</span>
      {designHref ? (
        <Link href={designHref} className={t.studioCta}>
          Sketch on aerial
          <span className={t.studioCtaSub}>Opens design studio</span>
        </Link>
      ) : null}
      <div className={t.titleBand}>
        <p className={t.kicker}>{kicker}</p>
        <p className={t.brand}>Curtis &amp; Co</p>
        <h2 className={t.address}>{address}</h2>
        <p className={t.metrics}>
          <strong>Backyard {Math.round(survey.garden_area_m2)} m²</strong>
          {" · "}
          Lot {Math.round(survey.lot_area_m2)} m² · House{" "}
          {Math.round(survey.house_area_m2)} m²
        </p>
      </div>
    </div>
  );
}

export function ProjectTitleHero({
  survey,
  address,
  siteContext,
  kicker = "Landscape project",
  designHref,
}: {
  survey: Survey | null;
  address: string;
  siteContext?: SiteContext | null;
  kicker?: string;
  designHref?: string;
}) {
  if (!survey) {
    return (
      <ProjectTitleCover
        address={address}
        kicker={kicker}
        subtitle="Run survey to map the backyard on the title"
      />
    );
  }
  return (
    <ProjectTitleSiteMap
      survey={survey}
      address={address}
      siteContext={siteContext}
      kicker={kicker}
      designHref={designHref}
    />
  );
}
