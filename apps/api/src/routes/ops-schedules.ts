import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import {
  boardWidthScale,
  buildLightingSchedule,
  buildMaterialSchedule,
  buildPlantingSchedule,
  buildTrenchSchedule,
  lightingScheduleCsv,
  materialScheduleCsv,
  plantingScheduleCsv,
  trenchScheduleCsv,
} from "@workstream/domain";

async function tipCanvas(
  store: FastifyInstance["store"],
  ownerId: string,
  projectId: string,
  branchId?: string,
) {
  return store.getDesignCanvas(ownerId, projectId, {
    branchId: branchId || undefined,
  });
}

export default async function opsScheduleRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/schedules/planting",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const q = request.query as { branch_id?: string; format?: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const canvas = await tipCanvas(
        fastify.store,
        ownerId,
        projectId,
        q.branch_id,
      );
      const symbols = await fastify.store.listCatalogSymbols(ownerId);
      const schedule = buildPlantingSchedule(
        canvas ?? { placements: [] },
        symbols,
      );
      if (q.format === "csv") {
        return reply
          .type("text/csv")
          .header(
            "content-disposition",
            'attachment; filename="planting-schedule.csv"',
          )
          .send(plantingScheduleCsv(schedule));
      }
      return reply.send({ schedule });
    },
  );

  fastify.get(
    "/:projectId/schedules/trench",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const q = request.query as { branch_id?: string; format?: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const canvas = await tipCanvas(
        fastify.store,
        ownerId,
        projectId,
        q.branch_id,
      );
      const schedule = buildTrenchSchedule(
        canvas ?? { construction_trenches: [] },
        boardWidthScale(canvas?.site_frame?.board_width_m ?? 20),
      );
      if (q.format === "csv") {
        return reply
          .type("text/csv")
          .header(
            "content-disposition",
            'attachment; filename="trench-schedule.csv"',
          )
          .send(trenchScheduleCsv(schedule));
      }
      return reply.send({ schedule });
    },
  );

  fastify.get(
    "/:projectId/schedules/lighting",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const q = request.query as { branch_id?: string; format?: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const canvas = await tipCanvas(
        fastify.store,
        ownerId,
        projectId,
        q.branch_id,
      );
      const symbols = await fastify.store.listCatalogSymbols(ownerId);
      const schedule = buildLightingSchedule(
        canvas ?? {
          placements: [],
          irrigation_zones: [],
          construction_trenches: [],
        },
        symbols,
        boardWidthScale(20),
      );
      if (q.format === "csv") {
        return reply
          .type("text/csv")
          .header(
            "content-disposition",
            'attachment; filename="lighting-schedule.csv"',
          )
          .send(lightingScheduleCsv(schedule));
      }
      return reply.send({ schedule });
    },
  );

  fastify.get(
    "/:projectId/schedules/material",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const q = request.query as { branch_id?: string; format?: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const costings = await fastify.store.listCostings(ownerId, projectId);
      const costing = costings[0];
      const schedule = buildMaterialSchedule({
        lineItems: costing?.line_items ?? [],
      });
      if (q.format === "csv") {
        return reply
          .type("text/csv")
          .header(
            "content-disposition",
            'attachment; filename="material-schedule.csv"',
          )
          .send(materialScheduleCsv(schedule));
      }
      return reply.send({ schedule });
    },
  );
}
