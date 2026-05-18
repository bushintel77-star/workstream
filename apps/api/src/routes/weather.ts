import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { fetchForecast } from "../lib/weather";
import { geocodeAddress } from "../lib/mapbox";

export default async function weatherRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/weather",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = await fastify.store.getProject(
        request.userId!,
        projectId,
      );
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const center =
        project.lat != null && project.lng != null
          ? { lat: project.lat, lng: project.lng }
          : await geocodeAddress(project.address);

      const forecast = await fetchForecast(center.lat, center.lng);
      return reply.send({ forecast });
    },
  );
}
