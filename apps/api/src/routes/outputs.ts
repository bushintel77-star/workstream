import { FastifyInstance } from "fastify";
import { z } from "zod";
import { OutputKindSchema } from "@walkthrough/contracts";
import { requireAuth } from "../plugins/auth";
import { runOutput } from "../lib/output-job";

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
      const parsed = RunBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid body", issues: parsed.error.issues });
      }

      const host = request.headers.host ?? "localhost:3001";
      const protocol = request.protocol;
      const baseUrl = process.env.PUBLIC_API_URL ?? `${protocol}://${host}`;

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
        const message = err instanceof Error ? err.message : "Output failed";
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
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.get(
    "/:projectId/outputs",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const outputs = await fastify.store.listOutputs(
        request.userId!,
        projectId,
      );
      return reply.send({ outputs });
    },
  );
}
