import { FastifyInstance } from "fastify";
import { VoiceIntentRequestSchema } from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { classifyVoiceIntent } from "../lib/voice-intent";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function voiceIntentRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/voice-intent/classify",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const parsed = VoiceIntentRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Validation failed",
          issues: parsed.error.issues,
        });
      }

      const result = await classifyVoiceIntent(parsed.data);
      return reply.send(result);
    },
  );
}
