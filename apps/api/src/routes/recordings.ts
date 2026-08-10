import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { audioPublicUrl, saveAudio } from "../lib/storage";
import { publicBaseUrl } from "../lib/public-url";
import { runCapturePipeline } from "../lib/capture-pipeline";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function recordingRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/recordings",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;

      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: "No audio file uploaded" });
      }

      const durationField = file.fields.duration_s;
      let durationS = 0;
      if (durationField && "value" in durationField) {
        const parsed = Number(durationField.value);
        if (Number.isFinite(parsed) && parsed > 0 && parsed <= 60 * 60) {
          durationS = Math.round(parsed);
        }
      }
      if (durationS <= 0) {
        return reply
          .code(400)
          .send({ error: "duration_s must be a positive integer ≤ 3600" });
      }

      const buffer = await file.toBuffer();
      const ext = file.mimetype?.includes("webm") ? "webm" : "m4a";

      const recording = await fastify.store.createRecording(
        ownerId,
        projectId,
        "",
        durationS
      );

      if (!recording) {
        return reply.code(500).send({ error: "Failed to create recording" });
      }

      const filePath = await saveAudio(recording.id, buffer, ext);

      const baseUrl = publicBaseUrl(request);
      recording.audio_uri = audioPublicUrl(baseUrl, recording.id, ext);

      void runCapturePipeline(
        fastify.store,
        ownerId,
        projectId,
        recording.id,
        filePath,
        baseUrl,
        fastify.log,
      ).catch((err) => {
        fastify.log.error(err, "Capture pipeline failed");
      });

      return reply.code(201).send({ recording });
    }
  );

  fastify.get(
    "/:projectId/recordings",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const recordings = await fastify.store.listRecordings(ownerId, projectId);
      return reply.send({ recordings });
    }
  );
}
