import { notFound } from "next/navigation";
import { pollProjectProgressAction } from "../../../../app/actions";
import { getProject } from "../../../../lib/api";
import { requireSignedIn } from "../../../../lib/auth";
import { ProcessingScreen } from "./ProcessingScreen";

export const dynamic = "force-dynamic";

export default async function ProcessingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  /* Own the auth gate: this was the one project surface relying on the
   * deleted `projects/[id]/layout.tsx` for `requireSignedIn`. Every sibling
   * already calls it directly. */
  await requireSignedIn();
  const project = await getProject(id);
  if (!project) notFound();
  const progress = await pollProjectProgressAction(id).catch(() => null);

  return (
    <ProcessingScreen
      projectId={project.id}
      address={project.address}
      status={project.status}
      progress={progress}
    />
  );
}
