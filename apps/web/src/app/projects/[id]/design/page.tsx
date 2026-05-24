import Link from "next/link";
import { requireProject } from "../../../../lib/project-guard";
import {
  getDesign,
  getDesignCanvas,
  getSurvey,
  listCatalogSymbols,
  listCostings,
  listRateCard,
} from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";
import { DesignStudioSection } from "./DesignStudioSection";

export const dynamic = "force-dynamic";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const survey = await getSurvey(id);
  const [canvas, symbols, rateCard] = await Promise.all([
    getDesignCanvas(id),
    survey ? listCatalogSymbols() : Promise.resolve([]),
    survey ? listRateCard() : Promise.resolve([]),
  ]);

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="design" />

      {!survey ? (
        <>
          <h1 className={s.headline}>Studio</h1>
          <p className={s.lede}>Run the survey first — the aerial site plan is required.</p>
          <div className={s.actionBar}>
            <Link href={`/projects/${id}/survey`} className={s.btn}>
              Complete survey first
            </Link>
          </div>
        </>
      ) : (
        <>
          <DesignStudioSection
            projectId={id}
            aerialUri={survey.aerial_uri}
            lotRing={survey.title_polygon.coordinates[0] as [number, number][]}
            symbols={symbols}
            rateCard={rateCard}
            canvas={canvas}
          />
          <p className={s.meta}>
            <Link href={`/projects/${id}/design/develop`}>
              Develop & estimate from sketch →
            </Link>
            {" · "}
            <Link href={`/projects/${id}/overview`}>Pipeline overview →</Link>
          </p>
        </>
      )}
    </main>
  );
}
