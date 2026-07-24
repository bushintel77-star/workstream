import { FastifyInstance } from "fastify";
import { KeylessHydrateRequestSchema } from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import { hydrateKeylessOverlays } from "../lib/keyless-job";
import type { VicmapKeylessKind } from "../lib/vicmap";

export default async function keylessRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/keyless-hydrate",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);

      const parsed = KeylessHydrateRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      try {
        const result = await hydrateKeylessOverlays(
          fastify.store,
          ownerId,
          projectId,
          parsed.data.kinds as VicmapKeylessKind[],
        );
        return reply.code(201).send(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "KEYLESS hydrate failed";
        return reply.code(400).send({ error: message });
      }
    },
  );
}
