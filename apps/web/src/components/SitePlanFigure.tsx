"use client";

import { useEffect, useState } from "react";
import type { Survey } from "../lib/api";
import { isMockSurveyLot } from "../lib/survey-source";
import { SitePlan } from "./SitePlan";
import sp from "./sitePlan.module.css";
import sk from "../styles/skeleton.module.css";

function isRealAerial(uri: string): boolean {
  return uri.startsWith("http") && !uri.startsWith("https://placeholder");
}

type Props = {
  survey: Survey;
  caption?: string;
};

export function SitePlanFigure({ survey, caption }: Props) {
  const [loaded, setLoaded] = useState(!isRealAerial(survey.aerial_uri));
  const mock = isMockSurveyLot(survey);

  useEffect(() => {
    if (!isRealAerial(survey.aerial_uri)) setLoaded(true);
  }, [survey.aerial_uri]);

  return (
    <>
      {mock && (
        <div className={sp.mockBanner} role="status">
          Approximate lot — rectangular mock geometry. Enable Vicmap on the API
          for cadastral boundaries, or re-run survey after pinning the address.
        </div>
      )}
      <div className={sp.figureHost}>
        {!loaded && (
          <div
            className={`${sk.skel} ${sp.planSkeleton}`}
            aria-hidden
          />
        )}
        <div className={loaded ? sp.figureVisible : sp.figureHidden}>
          <SitePlan
            survey={survey}
            caption={caption}
            onAerialLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </>
  );
}
