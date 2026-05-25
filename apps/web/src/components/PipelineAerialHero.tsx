import Link from "next/link";
import type { SiteContext, Survey } from "../lib/api";
import sh from "./pipelineImageShell.module.css";
import { SiteContextRibbon } from "./SiteContextRibbon";

type Props = {
  survey: Survey;
  projectId: string;
  badge?: string;
  honestyCaption?: string;
  siteContext?: SiteContext | null;
  showStudioLink?: boolean;
};

/** Read-only aerial column — shared by pipeline hub and survey. */
export function PipelineAerialHero({
  survey,
  projectId,
  badge = "Backyard mapped",
  honestyCaption = "Site context — open studio to sketch",
  siteContext = null,
  showStudioLink = true,
}: Props) {
  const designHref = `/projects/${projectId}/design`;

  return (
    <div className={sh.canvas} data-testid="pipeline-aerial-canvas">
      {/* Mapbox static satellite URL from survey — not user-uploaded input. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={survey.aerial_uri} alt="" className={sh.aerial} draggable={false} />
      <div className={sh.hudTop}>
        <span className={sh.hudBadge}>{badge}</span>
        {siteContext ? <SiteContextRibbon context={siteContext} /> : null}
        {showStudioLink ? (
          <Link href={designHref} className={sh.studioCta}>
            Open studio
            <span className={sh.studioCtaSub}>Sketch on aerial</span>
          </Link>
        ) : null}
      </div>
      <p className={sh.hudMetrics}>
        Backyard {Math.round(survey.garden_area_m2)} m² · Lot{" "}
        {Math.round(survey.lot_area_m2)} m² · House {Math.round(survey.house_area_m2)} m²
      </p>
      <p className={sh.honestyCaption}>{honestyCaption}</p>
    </div>
  );
}
