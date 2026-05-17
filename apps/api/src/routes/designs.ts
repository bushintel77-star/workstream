import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { runDesign } from "../lib/design-job";

export default async function designRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/design",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      try {
        const design = await runDesign(fastify.store, ownerId, projectId);
        return reply.code(201).send({ design });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Design failed";
        if (message.startsWith("Project not found")) {
          return reply.code(404).send({ error: message });
        }
        if (message.startsWith("Survey is required")) {
          return reply.code(409).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.get(
    "/:projectId/design",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const design = await fastify.store.getDesign(
        request.userId!,
        projectId,
      );
      if (!design) {
        return reply.code(404).send({ error: "Design not found" });
      }
      return reply.send({ design });
    },
  );
}
