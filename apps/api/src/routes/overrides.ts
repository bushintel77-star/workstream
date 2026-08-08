import { FastifyInstance } from "fastify";
import { CreateOverrideInputSchema } from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function overrideRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/overrides",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = CreateOverrideInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }

      try {
        const result = await fastify.store.createOverride(
          ownerId,
          projectId,
          parsed.data,
        );
        return reply.code(201).send(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Override failed";
        if (
          message.startsWith("Project not found") ||
          message.startsWith("Audit not found")
        ) {
          return reply.code(404).send({ error: message });
        }
        if (
          message.startsWith("Only blocking") ||
          message.startsWith("Finding index") ||
          message.startsWith("This finding is already")
        ) {
          return reply.code(409).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Override failed" });
      }
    },
  );

  fastify.get(
    "/:projectId/overrides",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const overrides = await fastify.store.listOverrides(ownerId, projectId);
      return reply.send({ overrides });
    },
  );
}
