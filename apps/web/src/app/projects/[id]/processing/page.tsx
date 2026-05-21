import { getProject } from "../../../../lib/api";
import { NotFoundPage } from "../ProjectShell";
import { ProjectProcessingClient } from "./ProjectProcessingClient";

export const dynamic = "force-dynamic";

export default async function ProjectProcessingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return <NotFoundPage message="Project not found." />;
  }

  return (
    <ProjectProcessingClient projectId={id} address={project.address} />
  );
}
