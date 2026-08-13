import { notFound } from "next/navigation";
import { requireSignedIn } from "../../../../lib/auth";
import { getProject, listOutputs } from "../../../../lib/api";
import { ProjectUtilitySurface } from "../../../../components/ProjectUtilitySurface";

export const dynamic = "force-dynamic";

export default async function OutputsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSignedIn();
  const project = await getProject(id);
  if (!project) notFound();
  return (
    <ProjectUtilitySurface
      type="outputs"
      projectId={id}
      outputs={await listOutputs(id)}
    />
  );
}
