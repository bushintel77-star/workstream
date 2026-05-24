import { FastifyInstance } from "fastify";
import { UpsertDesignCanvasSchema } from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function designCanvasRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/design-canvas",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await fastify.store.getProject(ownerId, projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }
      const canvas = await fastify.store.getDesignCanvas(ownerId, projectId);
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
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
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
