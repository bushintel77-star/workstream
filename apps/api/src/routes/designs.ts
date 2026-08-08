import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { runDesign } from "../lib/design-job";
import { runPipelineJobWithTelemetry } from "../lib/queue";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function designRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/design",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      try {
        const design = await runPipelineJobWithTelemetry(
          { kind: "design", ownerId, projectId },
          async () => await runDesign(fastify.store, ownerId, projectId),
        );
        return reply.code(201).send({ design });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Design failed";
        if (message.startsWith("Project not found")) {
          return reply.code(404).send({ error: message });
        }
        if (message.startsWith("Survey is required")) {
          return reply.code(409).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Design failed" });
      }
    },
  );

  fastify.get(
    "/:projectId/design",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const design = await fastify.store.getDesign(ownerId, projectId);
      if (!design) {
        return reply.code(404).send({ error: "Design not found" });
      }
      return reply.send({ design });
    },
  );
}
