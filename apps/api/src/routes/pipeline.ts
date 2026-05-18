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
      const project = await fastify.store.getProject(ownerId, projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      // Kick off the pipeline in the background; the client observes progress
      // by polling the project's status + child resources. Errors are logged
      // but don't propagate to the HTTP response.
      void runFullPipeline(fastify.store, ownerId, projectId).catch((err) => {
        request.log.error(err, "background pipeline failed");
      });

      return reply.code(202).send({ accepted: true });
    },
  );
}
