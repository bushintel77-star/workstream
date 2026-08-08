import { FastifyInstance } from "fastify";
import {
  CreateDocumentationPackageInputSchema,
  IssueDocumentationPackageInputSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import {
  boardWidthScale,
  buildLightingSchedule,
  buildMaterialSchedule,
  buildPlantingSchedule,
  buildTrenchSchedule,
  buildZip,
  lightingScheduleCsv,
  materialScheduleCsv,
  plantingScheduleCsv,
  trenchScheduleCsv,
} from "@workstream/domain";

export default async function documentationPackageRoutes(
  fastify: FastifyInstance,
) {
  fastify.get(
    "/:projectId/documentation-packages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const packages = await fastify.store.listDocumentationPackages(
        ownerId,
        projectId,
      );
      return reply.send({ packages });
    },
  );

  fastify.post(
    "/:projectId/documentation-packages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const parsed = CreateDocumentationPackageInputSchema.safeParse(
        request.body ?? {},
      );
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }

      const canvas = await fastify.store.getDesignCanvas(ownerId, projectId);
      const symbols = await fastify.store.listCatalogSymbols(ownerId);
      const costings = await fastify.store.listCostings(ownerId, projectId);
      const now = new Date().toISOString();
      const scale = boardWidthScale(canvas?.site_frame?.board_width_m ?? 20);
      const kinds = parsed.data.schedule_kinds;
      const schedules = [];

      if (kinds.includes("planting")) {
        const s = buildPlantingSchedule(canvas ?? { placements: [] }, symbols);
        schedules.push({
          kind: "planting" as const,
          title: "Planting schedule",
          rows: s.rows as unknown as Record<string, unknown>[],
          honesty: s.honesty,
          captured_at: now,
        });
      }
      if (kinds.includes("trench")) {
        const s = buildTrenchSchedule(
          canvas ?? { construction_trenches: [] },
          scale,
        );
        schedules.push({
          kind: "trench" as const,
          title: "Trench dig schedule",
          rows: s.rows as unknown as Record<string, unknown>[],
          honesty: s.honesty,
          captured_at: now,
        });
      }
      if (kinds.includes("lighting")) {
        const s = buildLightingSchedule(
          canvas ?? {
            placements: [],
            irrigation_zones: [],
            construction_trenches: [],
          },
          symbols,
          scale,
        );
        schedules.push({
          kind: "lighting" as const,
          title: "Lighting VA schedule",
          rows: s.rows as unknown as Record<string, unknown>[],
          honesty: s.honesty,
          captured_at: now,
        });
      }
      if (kinds.includes("material")) {
        const s = buildMaterialSchedule({
          lineItems: costings[0]?.line_items ?? [],
        });
        schedules.push({
          kind: "material" as const,
          title: "Material schedule",
          rows: s.rows as unknown as Record<string, unknown>[],
          honesty: s.honesty,
          captured_at: now,
        });
      }

      const pack = await fastify.store.createDocumentationPackage(
        ownerId,
        projectId,
        {
          ...parsed.data,
          schedules,
        },
      );
      return reply.code(201).send({ package: pack });
    },
  );

  fastify.post(
    "/:projectId/documentation-packages/:packId/issue",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, packId } = request.params as {
        projectId: string;
        packId: string;
      };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const parsed = IssueDocumentationPackageInputSchema.safeParse(
        request.body ?? {},
      );
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const pack = await fastify.store.issueDocumentationPackage(
          ownerId,
          projectId,
          packId,
          parsed.data,
        );
        if (!pack) return reply.code(404).send({ error: "Pack not found" });
        return reply.send({ package: pack });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Issue failed";
        return reply.code(409).send({ error: msg });
      }
    },
  );

  fastify.get(
    "/:projectId/documentation-packages/:packId/zip",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, packId } = request.params as {
        projectId: string;
        packId: string;
      };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const pack = await fastify.store.getDocumentationPackage(
        ownerId,
        projectId,
        packId,
      );
      if (!pack) return reply.code(404).send({ error: "Pack not found" });

      const entries: Array<{ name: string; data: string }> = [
        {
          name: "README.txt",
          data: [
            pack.title,
            `Status: ${pack.status}`,
            pack.issued_at ? `Issued: ${pack.issued_at}` : "Draft",
            "",
            "Indicative landscape-ops documentation — confirm on site / BYDA / electrician.",
          ].join("\n"),
        },
      ];

      for (const snap of pack.schedules) {
        if (snap.kind === "planting") {
          entries.push({
            name: "planting-schedule.csv",
            data: plantingScheduleCsv({
              rows: snap.rows as never,
              honesty: snap.honesty ?? "",
            }),
          });
        } else if (snap.kind === "trench") {
          entries.push({
            name: "trench-schedule.csv",
            data: trenchScheduleCsv({
              rows: snap.rows as never,
              honesty: snap.honesty ?? "",
            }),
          });
        } else if (snap.kind === "lighting") {
          entries.push({
            name: "lighting-schedule.csv",
            data: lightingScheduleCsv({
              rows: snap.rows as never,
              aggregate_design_va: 0,
              transformer_va: 0,
              honesty: snap.honesty ?? "",
            }),
          });
        } else if (snap.kind === "material") {
          entries.push({
            name: "material-schedule.csv",
            data: materialScheduleCsv({
              rows: snap.rows as never,
              honesty: snap.honesty ?? "",
            }),
          });
        }
        entries.push({
          name: `${snap.kind}-honesty.txt`,
          data: snap.honesty ?? "",
        });
      }

      const zip = buildZip(entries);
      return reply
        .type("application/zip")
        .header(
          "content-disposition",
          `attachment; filename="documentation-pack-${packId.slice(0, 8)}.zip"`,
        )
        .send(Buffer.from(zip));
    },
  );
}
