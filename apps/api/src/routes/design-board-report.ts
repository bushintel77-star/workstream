import { FastifyInstance } from "fastify";
import { DesignBoardReportResponseSchema } from "@workstream/contracts";
import {
  boardContextGaps,
  buildBoardDisclaimers,
  buildBoardSustainability,
} from "@workstream/domain";
import { requireAuth } from "../plugins/auth";
import { loadProjectBoard } from "../lib/board-context";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

/**
 * Sustainability read-out + export liability overlay over the whole board.
 *
 * Both reuse the BoardContext the assist and the findings already reason on —
 * the sustainability figures need survey area and irrigation geometry, and the
 * disclaimers need the planning flags and located assets, none of which the
 * studio holds client-side. One board load serves both, and the client reaches
 * it through a server action (client hooks must never import lib/api — ref
 * f0239bc).
 *
 * Both propose only. Which notice goes on an issued set stays a human act.
 */
export default async function designBoardReportRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/design/board-report",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const board = await loadProjectBoard(fastify.store, ownerId, project);
      const sustainability = buildBoardSustainability(board.context);
      const disclaimers = buildBoardDisclaimers(board.context);

      request.log.info(
        {
          project_id: projectId,
          metrics_measured: sustainability.measured,
          metrics_assessed: sustainability.assessed,
          disclaimers: disclaimers.length,
          disclaimers_required: disclaimers.filter((d) => d.required).length,
        },
        "design board report",
      );

      const payload = DesignBoardReportResponseSchema.parse({
        sustainability,
        disclaimers,
        gaps: boardContextGaps(board.context),
      });
      return reply.send(payload);
    },
  );
}
