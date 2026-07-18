import "server-only";

import { redirect } from "next/navigation";
import { getProject, type Project } from "./api";

type LoadProjectOptions = {
  /** Allow viewing while pipeline status is `processing`. */
  allowProcessing?: boolean;
};

/** Load a project or return null. Processing projects stay on the canvas. */
export async function requireProject(
  id: string,
  opts: LoadProjectOptions = {},
): Promise<Project | null> {
  const project = await getProject(id);
  if (!project) return null;
  if (project.status === "processing" && !opts.allowProcessing) {
    redirect(`/projects/${id}?mode=survey`);
  }
  return project;
}
