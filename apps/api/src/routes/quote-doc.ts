import { FastifyInstance } from "fastify";
import { UpsertQuoteDocInputSchema } from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function quoteDocRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/quote-doc",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const quoteDoc = await fastify.store.getQuoteDoc(ownerId, projectId);
      return reply.send({ quoteDoc });
    },
  );

  fastify.put(
    "/:projectId/quote-doc",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const parsed = UpsertQuoteDocInputSchema.safeParse({
        ...(request.body as object),
        project_id: projectId,
      });
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const quoteDoc = await fastify.store.upsertQuoteDoc(
        ownerId,
        projectId,
        parsed.data,
      );
      return reply.send({ quoteDoc });
    },
  );
}
