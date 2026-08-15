import { notFound } from "next/navigation";
import { requireSignedIn } from "../../../../lib/auth";
import {
  getAudit,
  getDesign,
  getProject,
  listOverrides,
  listProjectActivity,
} from "../../../../lib/api";
import { ProjectUtilitySurface } from "../../../../components/ProjectUtilitySurface";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSignedIn();
  const project = await getProject(id);
  if (!project) notFound();
  const [audit, design, overrides, activity] = await Promise.all([
    getAudit(id),
    getDesign(id),
    listOverrides(id),
    listProjectActivity(id).catch(() => []),
  ]);
  return (
    <ProjectUtilitySurface
      type="audit"
      projectId={id}
      designReady={design != null}
      audit={audit}
      overrides={overrides}
      activity={activity}
    />
  );
}
