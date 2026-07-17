import Link from "next/link";
import { Suspense } from "react";
import { requireProject } from "../../../../lib/project-guard";
import {
  getDesignCanvas,
  getSurvey,
  listCatalogSymbols,
  listRateCard,
} from "../../../../lib/api";
import { NotFoundPage } from "../ProjectShell";
import { DesignStudioSection } from "./DesignStudioSection";
import s from "../../../../styles/app.module.css";

export const dynamic = "force-dynamic";

/** Canvas-first sketch studio — no pipeline chrome. */
export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const survey = await getSurvey(id);
  if (!survey) {
    return (
      <div className={s.empty} style={{ padding: "var(--s-6)" }}>
        <h1 className={s.headline}>Design</h1>
        <p className={s.lede}>
          Run survey first — the aerial is required before you can sketch.
        </p>
        <Link href={`/projects/${id}/survey`} className={s.btn}>
          Complete survey
        </Link>
      </div>
    );
  }

  const [canvas, symbols, rateCard] = await Promise.all([
    getDesignCanvas(id),
    listCatalogSymbols(),
    listRateCard(),
  ]);

  return (
    <Suspense fallback={null}>
      <DesignStudioSection
        projectId={id}
        projectAddress={project.address}
        aerialUri={survey.aerial_uri}
        lotRing={survey.title_polygon.coordinates[0] as [number, number][]}
        symbols={symbols}
        rateCard={rateCard}
        canvas={canvas}
        surveyMetrics={{
          garden_area_m2: survey.garden_area_m2,
          lot_area_m2: survey.lot_area_m2,
          house_area_m2: survey.house_area_m2,
          lat: project.lat,
          lng: project.lng,
        }}
      />
    </Suspense>
  );
}
