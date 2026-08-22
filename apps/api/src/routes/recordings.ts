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

      const consentField = file.fields.dil_consent;
      const dilConsent =
        consentField && "value" in consentField
          ? consentField.value === "true"
          : false;
      if (!dilConsent) {
        return reply.code(400).send({
          error: "dil_consent must be true before transcription analysis",
        });
      }

      const buffer = await file.toBuffer();
      const ext = file.mimetype?.includes("webm") ? "webm" : "m4a";

      const recording = await fastify.store.createRecording(
        ownerId,
        projectId,
        "",
        durationS,
        dilConsent,
      );

      if (!recording) {
        return reply.code(500).send({ error: "Failed to create recording" });
      }

      let filePath: string;
      try {
        filePath = await saveAudio(recording.id, buffer, ext);
      } catch (err) {
        request.log.error(err, "Failed to persist recording audio");
        /* The row was created but the file never landed — remove it so we do
         * not leave an empty recording pointing at nothing. */
        await fastify.store
          .deleteRecording(ownerId, recording.id)
          .catch(() => undefined);
        return reply.code(500).send({ error: "Failed to store audio file" });
      }

      const baseUrl = publicBaseUrl(request);
      const uri = audioPublicUrl(baseUrl, recording.id, ext);
      /* Persist the final public URI — the create call records a placeholder
       * because the id (and therefore the filename) only exists after the row
       * is created. Writing it back keeps the durable row consistent with the
       * file that is actually on disk. */
      await fastify.store.updateRecordingAudioUri(recording.id, uri);
      recording.audio_uri = uri;

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
