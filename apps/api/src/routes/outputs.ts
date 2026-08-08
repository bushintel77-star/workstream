import { FastifyInstance } from "fastify";
import { z } from "zod";
import { OutputKindSchema } from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { runOutput } from "../lib/output-job";
import { publicBaseUrl } from "../lib/public-url";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

const RunBodySchema = z.object({
  kind: OutputKindSchema,
});

export default async function outputRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/outputs",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = RunBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid body", issues: parsed.error.issues });
      }

      let baseUrl: string;
      try {
        baseUrl = publicBaseUrl(request);
      } catch (err) {
        request.log.error(err, "Could not derive public base URL");
        return reply.code(500).send({
          error: "Server misconfigured: PUBLIC_API_URL not set",
        });
      }

      try {
        const output = await runOutput(
          fastify.store,
          ownerId,
          projectId,
          parsed.data.kind,
          baseUrl,
        );
        return reply.code(201).send({ output });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Output failed";
        if (
          message.startsWith("Survey is required") ||
          message.startsWith("Design is required") ||
          message.startsWith("Costing is required") ||
          message.startsWith("Audit has blocking") ||
          message.startsWith("Brochure output")
        ) {
          return reply.code(409).send({ error: message });
        }
        if (message.startsWith("Project not found")) {
          return reply.code(404).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Output failed" });
      }
    },
  );

  fastify.get(
    "/:projectId/outputs",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const outputs = await fastify.store.listOutputs(ownerId, projectId);
      return reply.send({ outputs });
    },
  );
}
