import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth";
import { ALL_SUPPLIERS, fetchPrices, type SupplierId } from "../lib/suppliers";

const SupplierParamsSchema = z.object({
  supplier: z.enum([
    "bunnings",
    "boral",
    "holcim",
    "andersons",
    "anl",
    "online_plants_au",
    "speciality_trees",
  ]),
});

export default async function supplierRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: requireAuth }, async (_request, reply) => {
    const lists = await Promise.all(
      ALL_SUPPLIERS.map((s) => fetchPrices(s as SupplierId)),
    );
    return reply.send({ suppliers: lists });
  });

  fastify.get(
    "/:supplier",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = SupplierParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(404).send({ error: "Unknown supplier" });
      }
      const prices = await fetchPrices(parsed.data.supplier as SupplierId);
      return reply.send(prices);
    },
  );
}
