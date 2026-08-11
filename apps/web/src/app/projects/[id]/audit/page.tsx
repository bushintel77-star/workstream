import { notFound } from "next/navigation";
import { requireSignedIn } from "../../../../lib/auth";
import { getAudit, getProject, listOverrides } from "../../../../lib/api";
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
  const [audit, overrides] = await Promise.all([getAudit(id), listOverrides(id)]);
  return <ProjectUtilitySurface type="audit" projectId={id} audit={audit} overrides={overrides} />;
}
