import { FastifyInstance } from "fastify";
import {
  SketchToCadRequestSchema,
  SketchToCadResponseSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { formalizeSketchToCad } from "../lib/claude";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function designSketchCadRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/design/sketch-cad",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const parsed = SketchToCadRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Invalid sketch payload", detail: parsed.error.message });
      }
      if (parsed.data.strokes.length === 0) {
        return reply.code(400).send({ error: "Sketch is empty — draw first." });
      }

      const symbols = await fastify.store.listCatalogSymbols(ownerId);
      const result = await formalizeSketchToCad({
        image_base64: parsed.data.image_base64,
        mime_type: parsed.data.mime_type,
        boundary: parsed.data.boundary,
        building: parsed.data.building,
        strokes: parsed.data.strokes,
        scale_m: parsed.data.scale_m,
        symbol_ids: symbols.map((s) => s.id),
      });

      const payload = SketchToCadResponseSchema.parse(result);
      return reply.send(payload);
    },
  );
}
