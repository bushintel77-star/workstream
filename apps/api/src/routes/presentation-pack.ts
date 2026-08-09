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
  /** Honest skip / readiness note for Assist checklist (PDF §4.9). */
  reason: z.string().nullable().optional(),
});

const PackResponseSchema = z.object({
  brochure_uri: z.string().nullable(),
  quote_uri: z.string().nullable(),
  schedule_uri: z.string().nullable(),
  supplier_uri: z.string().nullable(),
  notes: z.array(z.string()),
  checklist: z.array(ChecklistItemSchema),
});

/** Canvas-native deep links — not fake brochure PDFs (PDF §4.9 honesty). */
function studioLink(projectId: string, query: string): string {
  return `/projects/${projectId}?${query}`;
}

/**
 * Generate client presentation pack from the same commercial truth
 * (brochure + quote + plant schedule + supplier order when prerequisites exist).
 * Elevations / sun-cast / freeze point at handoff canvas deep links.
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
      let supplierUri: string | null = null;

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

      const costings = await fastify.store.listCostings(ownerId, projectId);
      const standard =
        costings.find((c) => c.scenario === "standard") ?? costings[0];
      const firmLines =
        standard?.line_items.filter((l) => !l.is_provisional) ?? [];
      const hasBomLines = firmLines.length > 0;
      const opsMaterialUri = studioLink(
        projectId,
        "mode=cad&ops=material&quote=1",
      );

      try {
        const supplier = await runOutput(
          fastify.store,
          ownerId,
          projectId,
          "supplier_order",
          baseUrl,
        );
        supplierUri = supplier.uri;
        notes.push(
          "Supplier order / delivery request generated from live quote lines.",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unavailable";
        if (hasBomLines) {
          notes.push(
            `Supplier HTML skipped (${msg}) — Ops material schedule + live cost remain available on canvas.`,
          );
        } else {
          notes.push(`Supplier order skipped: ${msg}`);
        }
      }

      const sunCastUri = studioLink(projectId, "mode=cad&shade=1");
      const elevationsUri = studioLink(projectId, "mode=elevation");
      const freezeUri = studioLink(projectId, "mode=cad&branches=1");

      const supplierChecklist = (() => {
        if (supplierUri) {
          return {
            id: "supplier",
            label: "Supplier order lists from live quote",
            status: "generated" as const,
            uri: supplierUri,
            reason: null as string | null,
          };
        }
        if (hasBomLines) {
          return {
            id: "supplier",
            label: "Supplier order lists from live quote",
            status: "ready" as const,
            uri: opsMaterialUri,
            reason:
              "Open Ops material schedule + live cost on the handoff canvas (same quote lines).",
          };
        }
        return {
          id: "supplier",
          label: "Supplier order lists from live quote",
          status: "skipped" as const,
          uri: null as string | null,
          reason:
            "No live quote / BOM lines yet — run costing or Add to Main Quote first.",
        };
      })();

      const checklist = [
        {
          id: "brochure",
          label: "Client brochure / presentation PDF",
          status: brochureUri
            ? ("generated" as const)
            : ("skipped" as const),
          uri: brochureUri,
          reason: brochureUri
            ? null
            : "Needs survey + design pipeline before brochure PDF.",
        },
        {
          id: "quote",
          label: "Itemised cost estimate / quote",
          status: quoteUri ? ("generated" as const) : ("skipped" as const),
          uri: quoteUri,
          reason: quoteUri
            ? null
            : "Needs survey, design, costing, and a passing audit before quote PDF.",
        },
        {
          id: "schedule",
          label: "Seasonal plant schedule with quantities",
          status: scheduleUri
            ? ("generated" as const)
            : ("skipped" as const),
          uri: scheduleUri,
          reason: scheduleUri
            ? null
            : "Needs survey + design pipeline before plant schedule PDF.",
        },
        {
          id: "elevations",
          label: "Elevations and simple sections",
          status: "ready" as const,
          uri: elevationsUri,
          reason: null,
        },
        {
          id: "sun-cast",
          label: "Sun-cast / overshadow (hero overlay + sun tools)",
          status: "ready" as const,
          uri: sunCastUri,
          reason: null,
        },
        supplierChecklist,
        {
          id: "freeze",
          label: "Frozen quote snapshot via design branches",
          status: "ready" as const,
          uri: freezeUri,
          reason: null,
        },
      ];

      notes.push(
        "Elevations, sun-cast and freeze open on the handoff canvas (deep links) — not separate brochure pages.",
      );
      if (supplierUri) {
        notes.push(
          "Supplier pack is a trade order / delivery request from quote lines — not a client brochure.",
        );
      } else if (hasBomLines) {
        notes.push(
          "Supplier checklist opens Ops schedules (material) + live cost when the HTML order sheet is unavailable.",
        );
      }
      if (!brochureUri && !quoteUri && !scheduleUri && !supplierUri) {
        notes.push(
          "PDF outputs need survey + design pipeline — canvas sun-cast / elevations / freeze links still work.",
        );
      }

      // Always 200 when checklist has canvas-native links — do not 422 away
      // the only honest sun-cast / elevation affordance (PDF §4.9).
      return reply.send(
        PackResponseSchema.parse({
          brochure_uri: brochureUri,
          quote_uri: quoteUri,
          schedule_uri: scheduleUri,
          supplier_uri: supplierUri,
          notes,
          checklist,
        }),
      );
    },
  );
}
