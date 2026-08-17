import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  BoardDisclaimerSchema,
  ProjectSignoffSchema,
} from "@workstream/contracts";
import { createSignoffRecord, signoffReadiness } from "@workstream/domain";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

const SignoffPutBodySchema = z.object({
  /** Design revision id the signoff is bound to. */
  revision: z.string().min(1),
  quote_total_incl_gst: z.number().positive(),
  accepted_notice_ids: z.array(z.string()),
  /** The disclaimers the client resolved from the board (client-authored). */
  disclaimers: z.array(BoardDisclaimerSchema),
  acknowledged: z.record(z.string(), z.boolean()),
});

/**
 * Project signoff — Screen 4's durable "issued" state.
 *
 * GET returns the persisted signoff (null when never signed).
 * PUT validates readiness (revision + quote + every required notice accepted,
 * safety waiver hard-gated) via the domain rule, then persists an immutable
 * signed-off record. A signoff is never fabricated: the server enforces the
 * gate even though the disclaimers themselves are resolved client-side from
 * board geometry.
 */
export default async function signoffRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/signoff",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const signoff = await fastify.store.getSignoff(ownerId, projectId);
      return reply.send({ signoff });
    },
  );

  fastify.put(
    "/:projectId/signoff",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);

      const parsed = SignoffPutBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const body = parsed.data;

      const existing = await fastify.store.getSignoff(ownerId, projectId);
      const readiness = signoffReadiness({
        disclaimers: body.disclaimers,
        acknowledged: body.acknowledged,
        revision: body.revision,
        quoteTotalInclGst: body.quote_total_incl_gst,
        existing,
      });

      if (!readiness.ready || readiness.signed_off) {
        return reply.code(409).send({ error: "Signoff not ready", readiness });
      }

      const record = createSignoffRecord({
        projectId,
        revision: body.revision,
        quoteTotalInclGst: body.quote_total_incl_gst,
        acceptedNoticeIds: body.accepted_notice_ids,
        signedBy: ownerId,
      });
      const persisted = await fastify.store.upsertSignoff(
        ownerId,
        projectId,
        ProjectSignoffSchema.omit({
          id: true,
          project_id: true,
          updated_at: true,
        }).parse(record),
      );
      return reply.code(201).send({ signoff: persisted });
    },
  );
}
