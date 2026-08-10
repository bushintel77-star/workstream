import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth";
import { loadMelbourneTradeCatalog } from "../lib/melbourne-trade-catalog";
import {
  ALL_SUPPLIERS,
  fetchPrices,
  supplierFeedStatusSummary,
  type SupplierId,
} from "../lib/suppliers";

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
    const status = supplierFeedStatusSummary(lists);
    const trade = await loadMelbourneTradeCatalog();
    return reply.send({
      suppliers: lists,
      status,
      melbourne_trade_catalog: {
        source: trade.source,
        offer_count: trade.offers.length,
        path: trade.path,
        honesty: trade.honesty,
      },
    });
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
