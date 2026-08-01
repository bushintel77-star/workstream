import { FastifyInstance } from "fastify";
import { UpsertDesignCanvasSchema } from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import { runSketchCosting } from "../lib/sketch-cost-job";
import { refreshOrchestration } from "../lib/material-orchestrator";

export default async function designCanvasRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/design-canvas",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const canvas = await fastify.store.getDesignCanvas(ownerId, projectId);
      if (!canvas) {
        return reply.send({
          canvas: {
            id: null,
            project_id: projectId,
            placements: [],
            strokes: [],
            annotations: [],
            image_layers: [],
            features: [],
            site_frame: null,
            presentation_pack: null,
            updated_at: null,
          },
          quote: null,
        });
      }
      return reply.send({ canvas, quote: null });
    },
  );

  fastify.put(
    "/:projectId/design-canvas",
    { preHandler: requireAuth, bodyLimit: 10 * 1024 * 1024 },
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
        ownerId,
        projectId,
        parsed.data,
      );

      // Auto quotation from sketch pins + outdoor (garden) area on survey.
      let quote: {
        total: number;
        budget_low: number;
        budget_mid: number;
        budget_high: number;
        garden_area_m2: number;
        line_count: number;
      } | null = null;

      if (canvas.placements.length > 0) {
        try {
          const { costing, envelope } = await runSketchCosting(
            fastify.store,
            ownerId,
            projectId,
          );
          const survey = await fastify.store.getSurvey(ownerId, projectId);
          quote = {
            total: costing.total,
            budget_low: envelope.budget_low,
            budget_mid: envelope.budget_mid,
            budget_high: envelope.budget_high,
            garden_area_m2: survey?.garden_area_m2 ?? 0,
            line_count: costing.line_items.length,
          };
        } catch (err) {
          request.log.warn(
            { err, projectId },
            "auto sketch quotation skipped",
          );
        }
      }

      let orchestration = null;
      try {
        orchestration = await refreshOrchestration(
          fastify.store,
          ownerId,
          projectId,
        );
      } catch (err) {
        request.log.warn({ err, projectId }, "orchestration refresh skipped");
      }

      return reply.send({ canvas, quote, orchestration });
    },
  );
}
