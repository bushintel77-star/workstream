import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function activityRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/activity",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const events = await fastify.store.listActivityEvents(ownerId, projectId);
      return reply.send({ events });
    },
  );
}
