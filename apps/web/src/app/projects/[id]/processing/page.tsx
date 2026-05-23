import { requireProject } from "../../../../lib/project-guard";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";
import { ProjectProcessingClient } from "./ProjectProcessingClient";
import s from "../../../../styles/app.module.css";

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
    <main className={s.page}>
      <ProjectMasthead project={project} active="processing" />
      <ProjectProcessingClient projectId={id} address={project.address} />
    </main>
  );
}
