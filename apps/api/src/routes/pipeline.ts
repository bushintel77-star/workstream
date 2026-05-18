import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { runFullPipeline } from "../lib/pipeline-job";

export default async function pipelineRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/pipeline",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      try {
        const result = await runFullPipeline(fastify.store, ownerId, projectId);
        return reply.code(result.ok ? 200 : 207).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Pipeline failed";
        if (message.startsWith("Project not found")) {
          return reply.code(404).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: message });
      }
    },
  );
}
