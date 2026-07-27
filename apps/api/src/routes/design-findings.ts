import { FastifyInstance } from "fastify";
import { DesignFindingsResponseSchema } from "@workstream/contracts";
import { boardContextGaps, buildBoardFindings } from "@workstream/domain";
import { requireAuth } from "../plugins/auth";
import { loadProjectBoard } from "../lib/board-context";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

/**
 * Cross-artefact findings over the whole board.
 *
 * The studio cannot compute these itself: it holds canvas geometry but no
 * survey, costing or rate card, so a client-side pass would be blind to quote
 * and area truth and would report conflicts that are not there. Findings are
 * assembled server-side where every artefact is real, and reach the client
 * through a server action (client hooks must never import lib/api — ref f0239bc).
 *
 * They propose only. Accepting or dismissing one stays a human act.
 */
export default async function designFindingsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/design/findings",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const board = await loadProjectBoard(fastify.store, ownerId, project);
      const findings = buildBoardFindings(board.context);

      request.log.info(
        {
          project_id: projectId,
          findings: findings.length,
          findings_critical: findings.filter((f) => f.severity === "critical")
            .length,
        },
        "design board findings",
      );

      const payload = DesignFindingsResponseSchema.parse({
        findings,
        gaps: boardContextGaps(board.context),
      });
      return reply.send(payload);
    },
  );
}
