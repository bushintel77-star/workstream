import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { runCosting } from "../lib/cost-job";
import { runSketchCosting } from "../lib/sketch-cost-job";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function costingRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/costing",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      try {
        const costings = await runCosting(fastify.store, ownerId, projectId);
        return reply.code(201).send({ costings });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Costing failed";
        if (message.startsWith("Design is required")) {
          return reply.code(409).send({ error: message });
        }
        if (message.startsWith("Project not found")) {
          return reply.code(404).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/costing/sketch",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      try {
        const result = await runSketchCosting(
          fastify.store,
          ownerId,
          projectId,
        );
        return reply.code(201).send(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Sketch estimate failed";
        if (
          message.includes("sketch") ||
          message.includes("Survey") ||
          message.includes("rate card")
        ) {
          return reply.code(409).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.get(
    "/:projectId/costing",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const costings = await fastify.store.listCostings(ownerId, projectId);
      return reply.send({ costings });
    },
  );
}
