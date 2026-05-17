import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth";

const RatePatchSchema = z.object({
  rate: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/rate-card",
    { preHandler: requireAuth },
    async (request, reply) => {
      const items = await fastify.store.listRateCard(request.userId!);
      return reply.send({ items, count: items.length });
    }
  );

  fastify.patch(
    "/rate-card/:sku",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { sku } = request.params as { sku: string };
      const parsed = RatePatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const item = await fastify.store.updateRateCardItem(
        request.userId!,
        sku,
        parsed.data,
      );
      if (!item) return reply.code(404).send({ error: "SKU not found" });
      return reply.send({ item });
    },
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
