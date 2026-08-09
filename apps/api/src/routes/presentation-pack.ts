import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import { runOutput } from "../lib/output-job";

const ChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["generated", "ready", "studio", "skipped"]),
  uri: z.string().nullable().optional(),
});

const PackResponseSchema = z.object({
  brochure_uri: z.string().nullable(),
  quote_uri: z.string().nullable(),
  schedule_uri: z.string().nullable(),
  notes: z.array(z.string()),
  checklist: z.array(ChecklistItemSchema),
});

/**
 * Generate client presentation pack from the same commercial truth
 * (brochure + quote + plant schedule when pipeline prerequisites exist).
 * Elevations / sun-cast remain studio-native — checklist points operators there.
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
      let scheduleUri: string | null = null;

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

      try {
        const schedule = await runOutput(
          fastify.store,
          ownerId,
          projectId,
          "schedule",
          baseUrl,
        );
        scheduleUri = schedule.uri;
        notes.push("Plant schedule generated from the same design truth.");
      } catch (err) {
        notes.push(
          `Plant schedule skipped: ${err instanceof Error ? err.message : "unavailable"}`,
        );
      }

      const checklist = [
        {
          id: "brochure",
          label: "Client brochure / presentation PDF",
          status: brochureUri
            ? ("generated" as const)
            : ("skipped" as const),
          uri: brochureUri,
        },
        {
          id: "quote",
          label: "Itemised cost estimate / quote",
          status: quoteUri ? ("generated" as const) : ("skipped" as const),
          uri: quoteUri,
        },
        {
          id: "schedule",
          label: "Seasonal plant schedule with quantities",
          status: scheduleUri
            ? ("generated" as const)
            : ("skipped" as const),
          uri: scheduleUri,
        },
        {
          id: "elevations",
          label: "Elevations and simple sections",
          status: "studio" as const,
          uri: null,
        },
        {
          id: "sun-cast",
          label: "Sun-cast / overshadow (hero overlay + sun tools)",
          status: "studio" as const,
          uri: null,
        },
        {
          id: "supplier",
          label: "Supplier order lists from live quote",
          status: quoteUri ? ("ready" as const) : ("skipped" as const),
          uri: quoteUri,
        },
        {
          id: "freeze",
          label: "Frozen quote snapshot via design branches",
          status: "studio" as const,
          uri: null,
        },
      ];

      notes.push(
        "Elevations, sun-cast and freeze remain on the handoff canvas (Elevation mode, hero overlay, Design branches).",
      );

      if (!brochureUri && !quoteUri && !scheduleUri) {
        return reply.code(422).send(
          PackResponseSchema.parse({
            brochure_uri: null,
            quote_uri: null,
            schedule_uri: null,
            notes:
              notes.length > 0
                ? notes
                : ["Run survey + design before presentation pack."],
            checklist,
          }),
        );
      }

      return reply.send(
        PackResponseSchema.parse({
          brochure_uri: brochureUri,
          quote_uri: quoteUri,
          schedule_uri: scheduleUri,
          notes,
          checklist,
        }),
      );
    },
  );
}
