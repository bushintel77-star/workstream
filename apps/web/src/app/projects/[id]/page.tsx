import { redirect } from "next/navigation";
import { getSurvey } from "../../../lib/api";
import { requireProject } from "../../../lib/project-guard";
import { NotFoundPage } from "./ProjectShell";

export const dynamic = "force-dynamic";

/** Project root — studio-first after survey; pipeline hub lives on /overview. */
export default async function ProjectEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) {
    return (
      <NotFoundPage message="That project couldn't be loaded — it may have been deleted or the API just restarted." />
    );
  }

  const survey = await getSurvey(id);
  redirect(survey ? `/projects/${id}/design` : `/projects/${id}/overview`);
}
