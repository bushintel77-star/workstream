import { FastifyInstance } from "fastify";
import {
  ListLeftoversResponseSchema,
  RegisterLeftoverInputSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";

export default async function resourcePoolRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/resource-pool",
    { preHandler: requireAuth },
    async (request, reply) => {
      const ownerId = request.userId!;
      const leftovers = await fastify.store.listLeftovers(ownerId);
      return reply.send(ListLeftoversResponseSchema.parse({ leftovers }));
    },
  );

  fastify.post(
    "/resource-pool",
    { preHandler: requireAuth },
    async (request, reply) => {
      const ownerId = request.userId!;
      const parsed = RegisterLeftoverInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const row = await fastify.store.registerLeftover(ownerId, parsed.data);
      if (!row) {
        return reply.code(422).send({ error: "No meaningful leftover excess" });
      }
      return reply.code(201).send(row);
    },
  );
}
