import { notFound } from "next/navigation";
import { requireSignedIn } from "../../../../lib/auth";
import { getProject, listRecordings } from "../../../../lib/api";
import { ProjectUtilitySurface } from "../../../../components/ProjectUtilitySurface";

export const dynamic = "force-dynamic";

export default async function RecordingsPage({
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
      type="recordings"
      projectId={id}
      recordings={await listRecordings(id).catch(() => [])}
    />
  );
}
