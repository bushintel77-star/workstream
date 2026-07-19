import { FastifyInstance } from "fastify";
import {
  DesignAssistRequestSchema,
  DesignAssistResponseSchema,
} from "@workstream/contracts";
import { formatSketchBriefForAi, isTier1WrightsTerrace } from "@workstream/domain";
import { requireAuth } from "../plugins/auth";
import { groundSpanFromSurvey } from "../lib/cad-ground";
import { runStudioAssist } from "../lib/claude";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function designAssistRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/design/assist",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const parsedBody = DesignAssistRequestSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Validation failed",
          issues: parsedBody.error.issues,
        });
      }

      const survey = await fastify.store.getSurvey(ownerId, projectId);
      const canvas = await fastify.store.getDesignCanvas(ownerId, projectId);
      const symbols = await fastify.store.listCatalogSymbols(ownerId);
      const symbolIds = symbols.map((s) => s.id);

      const span = survey ? groundSpanFromSurvey(survey) : null;
      const sketchBrief = formatSketchBriefForAi(
        canvas,
        symbols,
        survey ?? undefined,
        project.address,
      );
      const frame = canvas?.site_frame;
      const easementCount =
        frame?.easements?.filter((r) => r.length >= 3).length ?? 0;
      const serviceCount = frame?.services?.length ?? 0;

      const result = await runStudioAssist({
        project: { name: project.address, address: project.address },
        site: {
          width_m: span?.width_m,
          height_m: span?.height_m,
          lat: project.lat ?? undefined,
          lng: project.lng ?? undefined,
          easement_count: easementCount,
          service_count: serviceCount,
          scale_m: span?.width_m,
        },
        canvasElementCount: canvas?.placements.length ?? 0,
        message: parsedBody.data.message,
        sketch_brief: sketchBrief,
        symbol_ids: symbolIds,
        tier1: isTier1WrightsTerrace(project.address),
      });

      const payload = DesignAssistResponseSchema.parse(result);
      return reply.send(payload);
    },
  );
}
