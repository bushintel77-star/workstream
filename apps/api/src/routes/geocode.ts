import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth";
import { geocodeSearch } from "../lib/mapbox";

const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
});

export default async function geocodeRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/search",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = SearchQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Invalid query", issues: parsed.error.issues });
      }
      const q = parsed.data.q;
      if (!q) {
        return reply.send({ suggestions: [] });
      }
      try {
        const suggestions = await geocodeSearch(q);
        return reply.send({ suggestions });
      } catch (err) {
        request.log.warn({ err, q }, "geocode search failed");
        return reply
          .code(502)
          .send({ error: "Upstream geocode failed", suggestions: [] });
      }
    },
  );
}
