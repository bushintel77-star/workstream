import { FastifyInstance } from "fastify";
import { CreateCatalogSymbolSchema } from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";

export default async function catalogRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/symbols",
    { preHandler: requireAuth },
    async (request, reply) => {
      const symbols = await fastify.store.listCatalogSymbols(request.userId!);
      return reply.send({ symbols });
    },
  );

  fastify.post(
    "/symbols",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = CreateCatalogSymbolSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const symbol = await fastify.store.createCustomCatalogSymbol(
        request.userId!,
        parsed.data,
      );
      return reply.code(201).send({ symbol });
    },
  );

  fastify.delete(
    "/symbols/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const ok = await fastify.store.deleteCustomCatalogSymbol(
        request.userId!,
        id,
      );
      if (!ok) {
        return reply.code(404).send({
          error: "Symbol not found or not deletable (custom assets only)",
        });
      }
      return reply.send({ ok: true });
    },
  );
}
