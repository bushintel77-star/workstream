import { FastifyInstance } from "fastify";
import {
  BoundaryAutoTraceRequestSchema,
  IngestBoundaryGeoJsonSchema,
  UpsertSiteBoundarySchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import {
  autoTraceSiteBoundary,
  getSiteBoundaryDoc,
  ingestBoundaryGeoJson,
  lockSiteBoundaryDoc,
  resetSiteBoundaryDoc,
  saveSiteBoundaryDoc,
  unlockSiteBoundaryDoc,
} from "../lib/boundary-job";

export default async function boundaryRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/boundary",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const boundary = await getSiteBoundaryDoc(
        fastify.store,
        ownerId,
        projectId,
      );
      return reply.send({ boundary });
    },
  );

  fastify.put(
    "/:projectId/boundary",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const parsed = UpsertSiteBoundarySchema.safeParse({
        ...(request.body as object),
        project_id: projectId,
      });
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      try {
        const boundary = await saveSiteBoundaryDoc(
          fastify.store,
          ownerId,
          projectId,
          parsed.data,
        );
        return reply.send({ boundary });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save boundary";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/boundary/auto-trace",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const body = BoundaryAutoTraceRequestSchema.safeParse(request.body ?? {});
      if (!body.success) {
        return reply.code(400).send({ error: body.error.flatten() });
      }
      try {
        const { boundary, easements } = await autoTraceSiteBoundary(
          fastify.store,
          ownerId,
          projectId,
          body.data.prefer_gis,
        );
        return reply.code(201).send({ boundary, easements });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Auto-trace failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/boundary/ingest",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const body = IngestBoundaryGeoJsonSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: body.error.flatten() });
      }
      try {
        const boundary = await ingestBoundaryGeoJson(
          fastify.store,
          ownerId,
          projectId,
          body.data.polygon,
          body.data.source_kind,
          body.data.ai_confidence ?? null,
        );
        return reply.code(201).send({ boundary });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "GeoJSON ingest failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/boundary/lock",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      try {
        const boundary = await lockSiteBoundaryDoc(
          fastify.store,
          ownerId,
          projectId,
        );
        return reply.send({ boundary });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Lock failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/boundary/unlock",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      try {
        const boundary = await unlockSiteBoundaryDoc(
          fastify.store,
          ownerId,
          projectId,
        );
        return reply.send({ boundary });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unlock failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.delete(
    "/:projectId/boundary",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const ok = await resetSiteBoundaryDoc(fastify.store, ownerId, projectId);
      return reply.send({ deleted: ok });
    },
  );
}
