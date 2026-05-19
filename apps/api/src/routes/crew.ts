import { FastifyInstance } from "fastify";
import {
  CreateCrewMemberInputSchema,
  UpdateCrewMemberInputSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";

export default async function crewRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: requireAuth }, async (request, reply) => {
    const crew = await fastify.store.listCrew(request.userId!);
    return reply.send({ crew });
  });

  fastify.post("/", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CreateCrewMemberInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Validation failed", issues: parsed.error.issues });
    }
    const member = await fastify.store.createCrewMember(
      request.userId!,
      parsed.data,
    );
    return reply.code(201).send({ member });
  });

  fastify.patch(
    "/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateCrewMemberInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const member = await fastify.store.updateCrewMember(
        request.userId!,
        id,
        parsed.data,
      );
      if (!member) return reply.code(404).send({ error: "Crew member not found" });
      return reply.send({ member });
    },
  );

  fastify.delete(
    "/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const ok = await fastify.store.deleteCrewMember(request.userId!, id);
      if (!ok) return reply.code(404).send({ error: "Crew member not found" });
      return reply.code(204).send();
    },
  );
}
