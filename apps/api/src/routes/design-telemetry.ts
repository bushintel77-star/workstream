import { FastifyInstance } from "fastify";
import {
  DesignTelemetryResponseSchema,
  IngestTelemetryRequestSchema,
  TELEMETRY_UNITS,
  type TelemetryReading,
} from "@workstream/contracts";
import {
  assertTelemetryUnit,
  latestTelemetryByKind,
  telemetryUnitFor,
} from "@workstream/domain";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

/**
 * Twin telemetry ingest + read for the Live telemetry canvas toggle.
 *
 * Readings are stored as measured samples (or honestly labelled demo seeds).
 * They do not replace BoardSustainability modelled metrics.
 */
export default async function designTelemetryRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/design/telemetry",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const readings = await fastify.store.listTelemetryReadings(
        ownerId,
        projectId,
      );
      const payload = DesignTelemetryResponseSchema.parse({
        readings,
        latest: latestTelemetryByKind(readings),
        count: readings.length,
      });
      return reply.send(payload);
    },
  );

  fastify.post(
    "/:projectId/design/telemetry",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const parsed = IngestTelemetryRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "invalid_telemetry",
          details: parsed.error.flatten(),
        });
      }

      const created: TelemetryReading[] = [];
      for (const row of parsed.data.readings) {
        const unit = telemetryUnitFor(row.kind, row.unit);
        const check = assertTelemetryUnit(row.kind, unit);
        if (!check.ok) {
          return reply.code(400).send({
            error: "invalid_telemetry_unit",
            kind: row.kind,
            unit,
            expected: check.expected ?? TELEMETRY_UNITS[row.kind],
          });
        }
        const reading = await fastify.store.createTelemetryReading(
          ownerId,
          projectId,
          {
            kind: row.kind,
            value: row.value,
            unit,
            x_pct: row.x_pct ?? null,
            y_pct: row.y_pct ?? null,
            sensor_id: row.sensor_id ?? null,
            label: row.label ?? null,
            source: row.source ?? "sensor",
            observed_at: row.observed_at ?? new Date().toISOString(),
          },
        );
        created.push(reading);
      }

      const readings = await fastify.store.listTelemetryReadings(
        ownerId,
        projectId,
      );
      request.log.info(
        {
          project_id: projectId,
          ingested: created.length,
          total: readings.length,
        },
        "design telemetry ingest",
      );

      const payload = DesignTelemetryResponseSchema.parse({
        readings,
        latest: latestTelemetryByKind(readings),
        count: readings.length,
      });
      return reply.code(201).send(payload);
    },
  );
}
