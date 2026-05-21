import { FastifyInstance } from "fastify";
import { UpsertDesignCanvasSchema } from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";

export default async function designCanvasRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/design-canvas",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const canvas = await fastify.store.getDesignCanvas(
        request.userId!,
        projectId,
      );
      if (!canvas) {
        return reply.send({
          canvas: {
            id: null,
            project_id: projectId,
            placements: [],
            strokes: [],
            updated_at: null,
          },
        });
      }
      return reply.send({ canvas });
    },
  );

  fastify.put(
    "/:projectId/design-canvas",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const parsed = UpsertDesignCanvasSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const canvas = await fastify.store.upsertDesignCanvas(
        request.userId!,
        projectId,
        parsed.data,
      );
      return reply.send({ canvas });
    },
  );
}
