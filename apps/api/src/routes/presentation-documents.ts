import { FastifyInstance } from "fastify";
import {
  CreatePresentationDocumentInputSchema,
  PresentationDissectResponseSchema,
  PresentationFormatRequestSchema,
  PresentationFormatResponseSchema,
  UpdatePresentationDocumentInputSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import { dissectPlanWithVision } from "../lib/claude";
import { formatPageLayout } from "../lib/page-format";

const DOC_NOT_FOUND_BODY = { error: "Presentation document not found" } as const;

export default async function presentationDocumentRoutes(
  fastify: FastifyInstance,
) {
  fastify.get(
    "/:projectId/presentation-documents",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const documents = await fastify.store.listPresentationDocuments(
        ownerId,
        projectId,
      );
      return reply.send({ documents });
    },
  );

  fastify.get(
    "/:projectId/presentation-documents/:docId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, docId } = request.params as {
        projectId: string;
        docId: string;
      };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const doc = await fastify.store.getPresentationDocument(
        ownerId,
        projectId,
        docId,
      );
      if (!doc) {
        return reply.code(404).send(DOC_NOT_FOUND_BODY);
      }
      return reply.send({ document: doc });
    },
  );

  fastify.post(
    "/:projectId/presentation-documents",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = CreatePresentationDocumentInputSchema.safeParse(
        request.body ?? {},
      );
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Validation failed",
          issues: parsed.error.issues,
        });
      }
      const doc = await fastify.store.createPresentationDocument(
        ownerId,
        projectId,
        parsed.data,
      );
      return reply.code(201).send({ document: doc });
    },
  );

  fastify.put(
    "/:projectId/presentation-documents/:docId",
    { preHandler: requireAuth, bodyLimit: 10 * 1024 * 1024 },
    async (request, reply) => {
      const { projectId, docId } = request.params as {
        projectId: string;
        docId: string;
      };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = UpdatePresentationDocumentInputSchema.safeParse(
        request.body ?? {},
      );
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Validation failed",
          issues: parsed.error.issues,
        });
      }
      const doc = await fastify.store.updatePresentationDocument(
        ownerId,
        projectId,
        docId,
        parsed.data,
      );
      if (!doc) {
        return reply.code(404).send(DOC_NOT_FOUND_BODY);
      }
      return reply.send({ document: doc });
    },
  );

  fastify.delete(
    "/:projectId/presentation-documents/:docId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, docId } = request.params as {
        projectId: string;
        docId: string;
      };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const deleted = await fastify.store.deletePresentationDocument(
        ownerId,
        projectId,
        docId,
      );
      if (!deleted) {
        return reply.code(404).send(DOC_NOT_FOUND_BODY);
      }
      return reply.code(204).send();
    },
  );

  // --- Plan dissection (Phase 2 + Phase 2 stretch) ---
  // Auto-cut the finished DesignCanvas into proposed plan-crop ghosts.
  // Vision-enhanced when ANTHROPIC_API_KEY is available (semantic feature labels);
  // falls back to the pure heuristic otherwise. Ghosts are ephemeral review state;
  // acceptance pins them as PlanCropPanel entries via the document PUT.
  fastify.post(
    "/:projectId/presentation-dissect",
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
        return reply.code(404).send({
          error: "No design canvas — build the plan before dissecting",
        });
      }
      const result = await dissectPlanWithVision(canvas);
      const payload = PresentationDissectResponseSchema.parse(result);
      request.log.info(
        {
          project_id: projectId,
          canvas_revision: payload.canvas_revision,
          ghost_count: payload.ghosts.length,
          source: payload.source,
          placements: canvas.placements.length,
          north_bearing: canvas.site_frame?.north_bearing ?? null,
        },
        "presentation dissection",
      );
      return reply.send(payload);
    },
  );

  // --- AI editorial formatting (Phase 3) ---
  // Propose a layout (rect per panel) for a page given the deliverable type +
  // template. Heuristic-first (deterministic, testable); the formatter arranges
  // panels into template slots in the Curtis house style. Ghosts are ephemeral
  // — the designer reviews and accepts.
  fastify.post(
    "/:projectId/presentation-format",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = PresentationFormatRequestSchema.safeParse(
        request.body ?? {},
      );
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Validation failed",
          issues: parsed.error.issues,
        });
      }
      const result = formatPageLayout(parsed.data);
      const payload = PresentationFormatResponseSchema.parse(result);
      request.log.info(
        {
          project_id: projectId,
          deliverable_type: parsed.data.deliverable_type,
          template_id: parsed.data.template_id,
          panel_count: parsed.data.panels.length,
          ghost_count: payload.ghosts.length,
        },
        "presentation format",
      );
      return reply.send(payload);
    },
  );
}
