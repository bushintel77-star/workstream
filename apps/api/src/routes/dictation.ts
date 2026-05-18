import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth";
import { runDictation } from "../lib/dictation";

const DictationBodySchema = z.object({
  transcript: z.string().min(1).max(10_000),
});

export default async function dictationRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/dictation",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const parsed = DictationBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const result = await runDictation(
          fastify.store,
          request.userId!,
          projectId,
          parsed.data.transcript,
        );
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Dictation failed";
        if (message.startsWith("Project not found")) {
          return reply.code(404).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: message });
      }
    },
  );
}
