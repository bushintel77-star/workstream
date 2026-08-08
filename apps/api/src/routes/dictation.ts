import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth";
import { runDictation } from "../lib/dictation";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

const DictationBodySchema = z.object({
  transcript: z.string().min(1).max(10_000),
});

export default async function dictationRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/dictation",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = DictationBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const result = await runDictation(
          fastify.store,
          ownerId,
          projectId,
          parsed.data.transcript,
        );
        return reply.send(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Dictation failed";
        if (message.startsWith("Project not found")) {
          return reply.code(404).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Dictation failed" });
      }
    },
  );
}
