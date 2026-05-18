import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { geocodeSearch } from "../lib/mapbox";

export default async function geocodeRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/search",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { q } = request.query as { q?: string };
      if (!q) {
        return reply.send({ suggestions: [] });
      }
      try {
        const suggestions = await geocodeSearch(q);
        return reply.send({ suggestions });
      } catch (err) {
        request.log.warn(err, "geocode search failed");
        return reply.send({ suggestions: [] });
      }
    },
  );
}
