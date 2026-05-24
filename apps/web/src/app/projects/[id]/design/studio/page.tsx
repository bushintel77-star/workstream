import Link from "next/link";
import { requireProject } from "../../../../../lib/project-guard";
import {
  getDesignCanvas,
  getSurvey,
  listCatalogSymbols,
  listRateCard,
} from "../../../../../lib/api";
import s from "../../../../../styles/app.module.css";
import { NotFoundPage, ProjectMasthead } from "../../ProjectShell";
import { DesignStudio } from "../../../../../components/DesignStudio";

export const dynamic = "force-dynamic";

export default async function DesignStudioPage({
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
      <main className={s.page}>
        <ProjectMasthead project={project} active="design" />
        <h1 className={s.headline}>Design studio</h1>
        <p className={s.lede}>Run the survey first — the aerial site plan is required.</p>
        <Link href={`/projects/${id}/survey`} className={s.btn}>
          Go to survey
        </Link>
      </main>
    );
  }

  const [symbols, canvas, rateCard] = await Promise.all([
    listCatalogSymbols(),
    getDesignCanvas(id),
    listRateCard(),
  ]);

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="design" />
      <p className={s.meta}>
        <Link href={`/projects/${id}/design`}>← Back to design</Link>
      </p>
      <h1 className={s.headline}>Design studio</h1>
      <p className={s.lede}>
        Concept sketch on the survey aerial — place Curtis assets, mass planting,
        irrigation, and live schedule. Save before opening outputs.
      </p>
      <DesignStudio
        projectId={id}
        aerialUri={survey.aerial_uri}
        lotRing={survey.title_polygon.coordinates[0] as [number, number][]}
        symbols={symbols}
        initialPlacements={canvas?.placements ?? []}
        initialStrokes={
          canvas?.strokes?.map((st) => ({
            id: st.id,
            points: st.points,
            color: st.color,
            width_px: st.width_px,
          })) ?? []
        }
        initialIrrigationZones={canvas?.irrigation_zones ?? []}
        rateCard={rateCard}
      />
    </main>
  );
}
