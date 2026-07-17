import { FastifyInstance } from "fastify";
import { DesignGhostsResponseSchema } from "@workstream/contracts";
import { isTier1WrightsTerrace } from "@workstream/domain";
import { requireAuth } from "../plugins/auth";
import { scanAerialGhosts } from "../lib/claude";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function designGhostsRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/design/ghosts",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const survey = await fastify.store.getSurvey(ownerId, projectId);
      if (!survey?.aerial_uri) {
        return reply.code(400).send({ error: "Survey aerial required before AI scan." });
      }
      const symbols = await fastify.store.listCatalogSymbols(ownerId);
      const suggestions = await scanAerialGhosts({
        aerial_uri: survey.aerial_uri,
        symbol_ids: symbols.map((s) => s.id),
        tier1: isTier1WrightsTerrace(project.address),
      });
      const payload = DesignGhostsResponseSchema.parse({ suggestions });
      return reply.send(payload);
    },
  );
}
