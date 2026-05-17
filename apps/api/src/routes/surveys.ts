import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { runSurvey } from "../lib/survey-job";

export default async function surveyRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/survey",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      try {
        const survey = await runSurvey(fastify.store, ownerId, projectId);
        return reply.code(201).send({ survey });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Survey failed";
        if (message.startsWith("Project not found")) {
          return reply.code(404).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.get(
    "/:projectId/survey",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const survey = await fastify.store.getSurvey(request.userId!, projectId);
      if (!survey) {
        return reply.code(404).send({ error: "Survey not found" });
      }
      return reply.send({ survey });
    },
  );
}
