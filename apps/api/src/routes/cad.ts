import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CadAcceptRequestSchema,
  CadEditRequestSchema,
  CadGenerateRequestSchema,
  CostScenarioSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import {
  acceptCadDocument,
  editCadDocument,
  exportCadDxf,
  generateCadDocument,
  getCadWithSvg,
} from "../lib/cad-job";
import {
  runCadBuild,
  runCadQuantitySurvey,
  runCadQuote,
} from "../lib/cad-qs-job";

export default async function cadRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/cad",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const result = await getCadWithSvg(fastify.store, ownerId, projectId);
      return reply.send(result);
    },
  );

  fastify.get(
    "/:projectId/cad.dxf",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      try {
        const dxf = await exportCadDxf(fastify.store, ownerId, projectId);
        return reply
          .header("content-type", "application/dxf; charset=utf-8")
          .header(
            "content-disposition",
            `attachment; filename="workstream-${projectId.slice(0, 8)}.dxf"`,
          )
          .send(dxf);
      } catch (err) {
        const message = err instanceof Error ? err.message : "CAD export failed";
        return reply.code(404).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/cad/generate",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = CadGenerateRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const result = await generateCadDocument(
          fastify.store,
          ownerId,
          projectId,
          parsed.data,
        );
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "CAD generate failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/cad/edit",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = CadEditRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const result = await editCadDocument(
          fastify.store,
          ownerId,
          projectId,
          parsed.data.instruction,
        );
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "CAD edit failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/cad/accept",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = CadAcceptRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const result = await acceptCadDocument(
          fastify.store,
          ownerId,
          projectId,
          parsed.data.entity_ids,
        );
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "CAD accept failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/cad/quantity-survey",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      try {
        const survey = await runCadQuantitySurvey(
          fastify.store,
          ownerId,
          projectId,
        );
        return reply.send({ survey });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Quantity survey failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/cad/build",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const body = z
        .object({ scenario: CostScenarioSchema.optional() })
        .safeParse(request.body ?? {});
      if (!body.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: body.error.issues });
      }
      try {
        const build = await runCadBuild(
          fastify.store,
          ownerId,
          projectId,
          body.data.scenario ?? "standard",
        );
        return reply.send({ build });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "CAD build failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/cad/quote",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const body = z
        .object({ scenario: CostScenarioSchema.optional() })
        .safeParse(request.body ?? {});
      if (!body.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: body.error.issues });
      }
      try {
        const quote = await runCadQuote(
          fastify.store,
          ownerId,
          projectId,
          body.data.scenario ?? "standard",
        );
        return reply.send(quote);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "CAD quote failed";
        return reply.code(400).send({ error: message });
      }
    },
  );
}
