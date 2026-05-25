import { requireProject } from "../../../../lib/project-guard";
import {
  getDesignCanvas,
  getSurvey,
  listCatalogSymbols,
  listRateCard,
} from "../../../../lib/api";
import { NotFoundPage } from "../ProjectShell";
import {
  ProjectPipelineShell,
  StudioSurveyRequired,
} from "../../../../components/ProjectPipelineShell";
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
    <ProjectPipelineShell project={project} active="design" variant="immersive">
      {!survey ? (
        <StudioSurveyRequired projectId={id} />
      ) : (
        <DesignStudioSection
          projectId={id}
          aerialUri={survey.aerial_uri}
          lotRing={survey.title_polygon.coordinates[0] as [number, number][]}
          symbols={symbols}
          rateCard={rateCard}
          canvas={canvas}
        />
      )}
    </ProjectPipelineShell>
  );
}
