import { notFound } from "next/navigation";
import { requireSignedIn } from "../../../../lib/auth";
import { getProject, listPhotoMeasurements } from "../../../../lib/api";
import { ProjectUtilitySurface } from "../../../../components/ProjectUtilitySurface";

export const dynamic = "force-dynamic";

export default async function MeasurementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSignedIn();
  const project = await getProject(id);
  if (!project) notFound();
  const measurements = await listPhotoMeasurements(id).catch(() => []);
  return (
    <ProjectUtilitySurface
      type="measurements"
      projectId={id}
      measurements={measurements}
    />
  );
}
