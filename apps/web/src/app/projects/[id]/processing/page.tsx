import { requireProject } from "../../../../lib/project-guard";
import { NotFoundPage } from "../ProjectShell";
import {
  PipelineContent,
  ProjectPipelineShell,
} from "../../../../components/ProjectPipelineShell";
import { ProjectProcessingClient } from "./ProjectProcessingClient";

export const dynamic = "force-dynamic";

export default async function ProjectProcessingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id, { allowProcessing: true });
  if (!project) {
    return <NotFoundPage message="Project not found." />;
  }

  return (
    <ProjectPipelineShell project={project} active="processing">
      <PipelineContent>
        <ProjectProcessingClient projectId={id} address={project.address} />
      </PipelineContent>
    </ProjectPipelineShell>
  );
}
