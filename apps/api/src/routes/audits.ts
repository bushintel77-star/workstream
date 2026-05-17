import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { runProjectAudit } from "../lib/audit-job";

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/audit",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      try {
        const audit = await runProjectAudit(fastify.store, ownerId, projectId);
        return reply.code(201).send({ audit });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Audit failed";
        if (
          message.startsWith("Design is required") ||
          message.startsWith("Costing is required")
        ) {
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

  fastify.get(
    "/:projectId/audit",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const audit = await fastify.store.getAudit(request.userId!, projectId);
      if (!audit) return reply.code(404).send({ error: "Audit not found" });
      return reply.send({ audit });
    },
  );
}
