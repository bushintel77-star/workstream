import { notFound } from "next/navigation";
import { requireSignedIn } from "../../../../lib/auth";
import { getCarbon, getProject } from "../../../../lib/api";
import { ProjectUtilitySurface } from "../../../../components/ProjectUtilitySurface";

export const dynamic = "force-dynamic";

export default async function CarbonPage({
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
      type="carbon"
      projectId={id}
      report={await getCarbon(id)}
    />
  );
}
