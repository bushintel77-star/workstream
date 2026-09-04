import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CadAcceptRequestSchema,
  CadEditRequestSchema,
  CadGenerateRequestSchema,
  CadOpsBatchSchema,
  CostScenarioSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { requireOwnedProject } from "../lib/project-guard";
import {
  acceptCadDocument,
  applyCadOpsBatch,
  editCadDocument,
  ensureCadDocument,
  exportCadDxf,
  exportCadGltf,
  exportCadSync,
  generateCadDocument,
  getCadWithSvg,
} from "../lib/cad-job";
import {
  runCadBuild,
  runCadQuantitySurvey,
  runCadQuote,
} from "../lib/cad-qs-job";
import { refreshOrchestration } from "../lib/material-orchestrator";
import { publicBaseUrl } from "../lib/public-url";

/**
 * CAD routes. Every handler resolves its project through
 * `requireOwnedProject` (the tenant gate) and then carries `project.id` —
 * the store's UUID-validated id — into store calls, filenames and error
 * bodies. The raw `:projectId` path param is only ever the lookup key; it
 * never flows past the gate (that unvalidated flow is what the taint scan
 * flagged here before this refactor).
 */
export default async function cadRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/cad",
    { preHandler: requireAuth },
    async (request, reply) => {
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
      const result = await getCadWithSvg(fastify.store, request.userId!, project.id);
      return reply.send(result);
    },
  );

  fastify.get(
    "/:projectId/cad.dxf",
    { preHandler: requireAuth },
    async (request, reply) => {
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
      try {
        const dxf = await exportCadDxf(fastify.store, request.userId!, project.id);
        return reply
          .header("content-type", "application/dxf; charset=utf-8")
          .header(
            "content-disposition",
            `attachment; filename="workstream-${project.id.slice(0, 8)}.dxf"`,
          )
          .send(dxf);
      } catch (err) {
        const message = err instanceof Error ? err.message : "CAD export failed";
        return reply.code(404).send({ error: message });
      }
    },
  );

  fastify.get(
    "/:projectId/cad.gltf",
    { preHandler: requireAuth },
    async (request, reply) => {
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
      try {
        const gltf = await exportCadGltf(fastify.store, request.userId!, project.id);
        return reply
          .header("content-type", "model/gltf+json; charset=utf-8")
          .header(
            "content-disposition",
            `attachment; filename="workstream-${project.id.slice(0, 8)}.gltf"`,
          )
          .send(gltf);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "glTF export failed";
        return reply.code(404).send({ error: message });
      }
    },
  );

  fastify.get(
    "/:projectId/cad.sync.json",
    { preHandler: requireAuth },
    async (request, reply) => {
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
      try {
        const manifest = await exportCadSync(
          fastify.store,
          request.userId!,
          project.id,
        );
        return reply
          .header("content-type", "application/json; charset=utf-8")
          .header(
            "content-disposition",
            `attachment; filename="workstream-${project.id.slice(0, 8)}.sync.json"`,
          )
          .send(manifest);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "CAD sync manifest failed";
        return reply.code(404).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/cad/ensure",
    { preHandler: requireAuth },
    async (request, reply) => {
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
      try {
        const result = await ensureCadDocument(
          fastify.store,
          request.userId!,
          project.id,
        );
        return reply.send(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "CAD ensure failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/cad/ops",
    { preHandler: requireAuth },
    async (request, reply) => {
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
      const parsed = CadOpsBatchSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const result = await applyCadOpsBatch(
          fastify.store,
          request.userId!,
          project.id,
          parsed.data.ops,
        );
        void refreshOrchestration(fastify.store, request.userId!, project.id);
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "CAD ops failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  fastify.post(
    "/:projectId/cad/generate",
    { preHandler: requireAuth },
    async (request, reply) => {
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
      const parsed = CadGenerateRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const result = await generateCadDocument(
          fastify.store,
          request.userId!,
          project.id,
          parsed.data,
        );
        void refreshOrchestration(fastify.store, request.userId!, project.id);
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
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
      const parsed = CadEditRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const result = await editCadDocument(
          fastify.store,
          request.userId!,
          project.id,
          parsed.data.instruction,
        );
        void refreshOrchestration(fastify.store, request.userId!, project.id);
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
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
      const parsed = CadAcceptRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const result = await acceptCadDocument(
          fastify.store,
          request.userId!,
          project.id,
          parsed.data.entity_ids,
        );
        void refreshOrchestration(fastify.store, request.userId!, project.id);
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
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
      try {
        const survey = await runCadQuantitySurvey(
          fastify.store,
          request.userId!,
          project.id,
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
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
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
          request.userId!,
          project.id,
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
      const project = await requireOwnedProject(fastify.store, request, reply);
      if (!project) return reply;
      const body = z
        .object({ scenario: CostScenarioSchema.optional() })
        .safeParse(request.body ?? {});
      if (!body.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: body.error.issues });
      }
      try {
        let baseUrl: string | undefined;
        try {
          baseUrl = publicBaseUrl(request);
        } catch {
          baseUrl = undefined;
        }
        const quote = await runCadQuote(
          fastify.store,
          request.userId!,
          project.id,
          body.data.scenario ?? "standard",
          baseUrl,
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
