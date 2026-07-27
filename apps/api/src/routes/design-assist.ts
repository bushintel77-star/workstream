import { FastifyInstance } from "fastify";
import {
  DesignAssistRequestSchema,
  DesignAssistResponseSchema,
} from "@workstream/contracts";
import {
  buildBoardFindings,
  formatBoardContextForAi,
  formatBoardFindingsForAi,
  isTier1WrightsTerrace,
} from "@workstream/domain";
import { requireAuth } from "../plugins/auth";
import { loadProjectBoard } from "../lib/board-context";
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

      /*
       * BoardContext v1 — the whole board at full depth (time, level, system,
       * cost). Replaces the flat sketch brief on this route, which could only
       * express label/category/count/position/SKU. The design pipeline still
       * uses the flat brief (see lib/design-job.ts).
       */
      const board = await loadProjectBoard(fastify.store, ownerId, project);
      const { context, canvas, span, intel } = board;

      /*
       * Cross-artefact findings are computed deterministically and handed to the
       * model already cited, so consequence comes from the board rather than
       * from the model's imagination. They propose only — accept stays human.
       */
      const findings = buildBoardFindings(context);
      const boardBrief = [
        formatBoardContextForAi(context),
        formatBoardFindingsForAi(findings),
      ].join("\n\n");
      // Payload telemetry — context growth should be visible, not a surprise.
      request.log.info(
        {
          project_id: projectId,
          board_context_bytes: Buffer.byteLength(boardBrief, "utf8"),
          planting: context.planting.length,
          surfaces: context.surfaces.length,
          quote_lines: context.commercial.quote_lines.length,
          findings: findings.length,
          findings_critical: findings.filter((f) => f.severity === "critical")
            .length,
        },
        "design assist board context",
      );

      const result = await runStudioAssist({
        project: { name: project.address, address: project.address },
        site: {
          width_m: span?.width_m,
          height_m: span?.height_m,
          lat: project.lat ?? undefined,
          lng: project.lng ?? undefined,
          easement_count: board.easementCount,
          service_count: board.serviceCount,
          scale_m: span?.width_m,
          sun_hours: intel.sun_hours,
          compliance_summary: intel.compliance_summary,
          shade_summary: intel.shade_summary,
        },
        canvasElementCount: canvas?.placements.length ?? 0,
        message: parsedBody.data.message,
        board_context: boardBrief,
        stroke_count: canvas?.strokes.length ?? 0,
        symbol_ids: board.symbols.map((s) => s.id),
        tier1: isTier1WrightsTerrace(project.address),
      });

      const payload = DesignAssistResponseSchema.parse(result);
      return reply.send(payload);
    },
  );
}
