import Link from "next/link";
import { requireProject } from "../../../../../lib/project-guard";
import {
  getDesignCanvas,
  getSurvey,
  listCatalogSymbols,
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

  const [symbols, canvas] = await Promise.all([
    listCatalogSymbols(),
    getDesignCanvas(id),
  ]);

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="design" />
      <p className={s.meta}>
        <Link href={`/projects/${id}/design`}>← Back to design</Link>
      </p>
      <h1 className={s.headline}>Design studio</h1>
      <p className={s.lede}>
        Back-of-envelope sketch: trees, lawn, paving, plus{" "}
        <strong>Tree protection zone</strong> and{" "}
        <strong>Existing tree (retain)</strong> when TRP or council planning
        applies. Save, then envelope estimate on the Design page.
      </p>
      <DesignStudio
        projectId={id}
        aerialUri={survey.aerial_uri}
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
      />
    </main>
  );
}
