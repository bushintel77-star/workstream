import { notFound } from "next/navigation";
import { getProject } from "../../../../lib/api";
import { ProcessingScreen } from "./ProcessingScreen";

export const dynamic = "force-dynamic";

export default async function ProcessingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <ProcessingScreen
      projectId={project.id}
      address={project.address}
      status={project.status}
    />
  );
}
