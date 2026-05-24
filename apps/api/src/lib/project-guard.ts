import type { Project } from "@workstream/contracts";
import type { Store } from "@workstream/db";

/** Route-level tenant gate — prefer before project-scoped store reads. */
export async function getOwnedProject(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<Project | null> {
  return store.getProject(ownerId, projectId);
}

export const PROJECT_NOT_FOUND_BODY = { error: "Project not found" } as const;
