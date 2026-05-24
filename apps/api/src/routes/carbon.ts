import { FastifyInstance } from "fastify";
import { totalEmbodiedCarbon } from "@workstream/domain";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function carbonRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/carbon",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const costings = await fastify.store.listCostings(ownerId, projectId);
      const standard =
        costings.find((c) => c.scenario === "standard") ?? costings[0];
      if (!standard) {
        return reply
          .code(404)
          .send({ error: "Costing required before carbon estimate." });
      }

      const breakdown = totalEmbodiedCarbon(
        standard.line_items.map((li) => ({ sku: li.sku, qty: li.qty })),
      );
      return reply.send({ scenario: standard.scenario, ...breakdown });
    },
  );
}
