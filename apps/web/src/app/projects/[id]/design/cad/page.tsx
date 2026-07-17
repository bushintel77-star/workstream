import Link from "next/link";
import { requireProject } from "../../../../../lib/project-guard";
import {
  getCadDocumentApi,
  getDesignCanvas,
  getSurvey,
} from "../../../../../lib/api";
import { NotFoundPage } from "../../ProjectShell";
import { AiCadStudio } from "../../../../../components/AiCadStudio";
import s from "../../../../../styles/app.module.css";

export const dynamic = "force-dynamic";

/** Canvas-first AI CAD — no pipeline chrome. */
export default async function DesignCadPage({
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
        <h1 className={s.headline}>AI CAD</h1>
        <p className={s.lede}>
          Run survey first — the aerial grounds metre-space CAD.
        </p>
        <Link href={`/projects/${id}/survey`} className={s.btn}>
          Complete survey
        </Link>
      </div>
    );
  }

  const [canvas, cad] = await Promise.all([
    getDesignCanvas(id),
    getCadDocumentApi(id).catch(() => ({
      document: null,
      svg: null,
      ghost_count: 0,
    })),
  ]);

  return (
    <AiCadStudio
      projectId={id}
      projectAddress={project.address}
      aerialUri={survey.aerial_uri}
      initialDocument={cad.document}
      initialSvg={cad.svg}
      initialGhostCount={cad.ghost_count}
      hasSketch={(canvas?.placements?.length ?? 0) > 0}
    />
  );
}
