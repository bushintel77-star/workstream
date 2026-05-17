import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/rate-card",
    { preHandler: requireAuth },
    async (request, reply) => {
      const items = await fastify.store.listRateCard(request.userId!);
      return reply.send({ items, count: items.length });
    }
  );

  fastify.get(
    "/plant-palette",
    { preHandler: requireAuth },
    async (request, reply) => {
      const items = await fastify.store.listPlantPalette(request.userId!);
      return reply.send({ items, count: items.length });
    }
  );
}
