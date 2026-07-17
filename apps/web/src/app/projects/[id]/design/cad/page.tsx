import { requireProject } from "../../../../../lib/project-guard";
import { getCadDocumentApi, getDesignCanvas, getSurvey } from "../../../../../lib/api";
import { NotFoundPage } from "../../ProjectShell";
import {
  ProjectPipelineShell,
  StudioSurveyRequired,
} from "../../../../../components/ProjectPipelineShell";
import { AiCadStudio } from "../../../../../components/AiCadStudio";

export const dynamic = "force-dynamic";

export default async function DesignCadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const survey = await getSurvey(id);
  const [canvas, cad] = await Promise.all([
    getDesignCanvas(id),
    getCadDocumentApi(id).catch(() => ({
      document: null,
      svg: null,
      ghost_count: 0,
    })),
  ]);

  return (
    <ProjectPipelineShell project={project} active="design" variant="immersive">
      {!survey ? (
        <StudioSurveyRequired projectId={id} />
      ) : (
        <AiCadStudio
          projectId={id}
          projectAddress={project.address}
          aerialUri={survey.aerial_uri}
          initialDocument={cad.document}
          initialSvg={cad.svg}
          initialGhostCount={cad.ghost_count}
          hasSketch={(canvas?.placements?.length ?? 0) > 0}
        />
      )}
    </ProjectPipelineShell>
  );
}
