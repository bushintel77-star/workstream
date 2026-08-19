import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { fetchForecast } from "../lib/weather";
import { geocodeAddress } from "../lib/geocode";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function weatherRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/weather",
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

      const forecast = await fetchForecast(center.lat, center.lng);
      return reply.send({ forecast });
    },
  );
}
