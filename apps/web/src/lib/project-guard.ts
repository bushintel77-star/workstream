import "server-only";

import { redirect } from "next/navigation";
import { getProject, type Project } from "./api";

type LoadProjectOptions = {
  /** Allow viewing while pipeline status is `processing` (that route only). */
  allowProcessing?: boolean;
};

/** Load a project or return null. Redirects to the processing screen when active. */
export async function requireProject(
  id: string,
  opts: LoadProjectOptions = {},
): Promise<Project | null> {
  const project = await getProject(id);
  if (!project) return null;
  if (project.status === "processing" && !opts.allowProcessing) {
    redirect(`/projects/${id}/processing`);
  }
  return project;
}
