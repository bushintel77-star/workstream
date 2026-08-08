import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import { runOutput } from "../lib/output-job";

const PackResponseSchema = z.object({
  brochure_uri: z.string().nullable(),
  quote_uri: z.string().nullable(),
  notes: z.array(z.string()),
});

/**
 * Generate client presentation pack from the same commercial truth
 * (brochure + quote when pipeline prerequisites exist).
 */
export default async function presentationPackRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/presentation-pack",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const baseUrl =
        process.env.API_PUBLIC_URL ??
        `http://${request.hostname.includes(":") ? "localhost:3001" : request.hostname}`;
      const notes: string[] = [];
      let brochureUri: string | null = null;
      let quoteUri: string | null = null;

      try {
        const brochure = await runOutput(
          fastify.store,
          ownerId,
          projectId,
          "brochure",
          baseUrl,
        );
        brochureUri = brochure.uri;
        notes.push("Brochure generated from design + survey.");
      } catch (err) {
        notes.push(
          `Brochure skipped: ${err instanceof Error ? err.message : "unavailable"}`,
        );
      }

      try {
        const quote = await runOutput(
          fastify.store,
          ownerId,
          projectId,
          "quote",
          baseUrl,
        );
        quoteUri = quote.uri;
        notes.push("Quote pack linked to live costing.");
      } catch (err) {
        notes.push(
          `Quote skipped: ${err instanceof Error ? err.message : "unavailable"}`,
        );
      }

      if (!brochureUri && !quoteUri) {
        return reply.code(422).send(
          PackResponseSchema.parse({
            brochure_uri: null,
            quote_uri: null,
            notes:
              notes.length > 0
                ? notes
                : ["Run survey + design before presentation pack."],
          }),
        );
      }

      return reply.send(
        PackResponseSchema.parse({
          brochure_uri: brochureUri,
          quote_uri: quoteUri,
          notes,
        }),
      );
    },
  );
}
