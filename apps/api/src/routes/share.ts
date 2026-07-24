import { FastifyInstance } from "fastify";
import {
  CreateShareRevisionInputSchema,
  PublicSharePayloadSchema,
  ShareDecisionInputSchema,
  ShareRevisionSchema,
  shareSnapshotFingerprint,
  type PublicSharePayload,
  type ShareRevision,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import { portalBaseUrl } from "../lib/magic-link";

/** Identical body for unknown and superseded GET — no token oracle. */
const SHARE_NOT_FOUND_BODY = { error: "Not found" } as const;

function buildShareUrl(token: string): string {
  return `${portalBaseUrl()}/share/${token}`;
}

function toPublicPayload(row: ShareRevision): PublicSharePayload | null {
  if (row.status === "superseded") return null;
  const payload = {
    revision: row.revision,
    status: row.status as "shared" | "accepted" | "declined",
    created_at: row.created_at,
    snapshot: row.snapshot,
    ...(row.decision ? { decision: row.decision } : {}),
  };
  const parsed = PublicSharePayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export default async function shareRoutes(fastify: FastifyInstance) {
  // --- Authed: owner ---
  fastify.get(
    "/projects/:projectId/share-revisions",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const revisions = await fastify.store.listShareRevisions(
        ownerId,
        projectId,
      );
      return reply.send({ revisions, share_base_url: `${portalBaseUrl()}/share` });
    },
  );

  fastify.post(
    "/projects/:projectId/share-revisions",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const parsed = CreateShareRevisionInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Validation failed",
          issues: parsed.error.issues,
        });
      }

      const canvas = await fastify.store.getDesignCanvas(ownerId, projectId);
      const snapshot = {
        canvas: canvas
          ? {
              ...canvas,
              irrigation_zones: canvas.irrigation_zones ?? [],
              construction_trenches: canvas.construction_trenches ?? [],
              annotations: canvas.annotations ?? [],
              features: canvas.features ?? [],
            }
          : null,
        quoteLines: parsed.data.quoteLines,
        totalInclGst: parsed.data.totalInclGst,
        address: project.address,
      };

      const existing = await fastify.store.listShareRevisions(ownerId, projectId);
      const latestOpenOrAny = existing[0];
      if (
        latestOpenOrAny &&
        shareSnapshotFingerprint(latestOpenOrAny.snapshot) ===
          shareSnapshotFingerprint(snapshot)
      ) {
        return reply.code(409).send({
          error: "Nothing changed since the last share",
          revision: latestOpenOrAny,
          share_url: buildShareUrl(latestOpenOrAny.token),
          unchanged: true,
        });
      }

      const revision = await fastify.store.createShareRevision(
        ownerId,
        projectId,
        snapshot,
      );
      if (!revision) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const checked = ShareRevisionSchema.safeParse(revision);
      if (!checked.success) {
        return reply.code(500).send({ error: "Invalid share revision" });
      }

      return reply.code(201).send({
        revision: checked.data,
        share_url: buildShareUrl(checked.data.token),
      });
    },
  );

  // --- Public: client (token-gated) ---
  fastify.get(
    "/share/:token",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      if (!token || token.length < 20) {
        return reply.code(404).send(SHARE_NOT_FOUND_BODY);
      }
      const row = await fastify.store.getShareRevisionByToken(token);
      if (!row || row.status === "superseded") {
        return reply.code(404).send(SHARE_NOT_FOUND_BODY);
      }
      const payload = toPublicPayload(row);
      if (!payload) {
        return reply.code(404).send(SHARE_NOT_FOUND_BODY);
      }
      return reply.send(payload);
    },
  );

  fastify.post(
    "/share/:token/decision",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      if (!token || token.length < 20) {
        return reply.code(404).send(SHARE_NOT_FOUND_BODY);
      }

      const parsed = ShareDecisionInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Validation failed",
          issues: parsed.error.issues,
        });
      }

      const result = await fastify.store.recordShareDecision(token, parsed.data);
      if (!result.ok) {
        if (result.reason === "superseded") {
          return reply
            .code(410)
            .send({ error: "a newer version exists" });
        }
        if (result.reason === "already_decided") {
          return reply.code(409).send({ error: "Already decided" });
        }
        return reply.code(404).send(SHARE_NOT_FOUND_BODY);
      }

      const payload = toPublicPayload(result.revision);
      return reply.send({
        ok: true,
        payload,
      });
    },
  );
}

/** Exported for unit tests that assert body identity. */
export { SHARE_NOT_FOUND_BODY };
