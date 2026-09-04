import type { FastifyReply, FastifyRequest } from "fastify";
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

/**
 * The route-facing form of the tenant gate: resolve the project the
 * authenticated caller owns, or reply 404 and return null.
 *
 * Must run behind `requireAuth` — it reads `request.userId`, which the auth
 * plugin guarantees. Handler contract:
 *
 *   const project = await requireOwnedProject(fastify.store, request, reply);
 *   if (!project) return reply;
 *
 * Downstream code MUST use `project.id` (the store's UUID-validated id),
 * never the raw path param. The path param is only the lookup key: handing
 * it onward past the gate is what the taint scanner rightly flags, because
 * it carries request-controlled bytes into store calls, filenames and error
 * bodies that the ownership check never certified.
 */
export async function requireOwnedProject(
  store: Store,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<Project | null> {
  const { projectId } = request.params as { projectId: string };
  const project = await getOwnedProject(store, request.userId!, projectId);
  if (!project) {
    reply.code(404).send(PROJECT_NOT_FOUND_BODY);
  }
  return project;
}
