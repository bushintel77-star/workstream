import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { geocodeAddress } from "../lib/mapbox";
import { buildSiteContext } from "../lib/site-context";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function siteContextRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/site-context",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const center =
        project.lat != null && project.lng != null
          ? { lat: project.lat, lng: project.lng }
          : await geocodeAddress(project.address);

      const survey = await fastify.store.getSurvey(ownerId, projectId);
      const context = await buildSiteContext({
        address: project.address,
        lat: center.lat,
        lng: center.lng,
        survey: survey ?? null,
      });

      return reply.send({ context });
    },
  );
}
