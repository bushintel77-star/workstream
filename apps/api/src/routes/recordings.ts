import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { audioPublicUrl, saveAudio } from "../lib/storage";
import { runTranscription } from "../lib/transcription-job";

export default async function recordingRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/recordings",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;

      const project = await fastify.store.getProject(ownerId, projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: "No audio file uploaded" });
      }

      const durationField = file.fields.duration_s;
      let durationS = 0;
      if (durationField && "value" in durationField) {
        durationS = Number(durationField.value) || 0;
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

      const host = request.headers.host ?? "localhost:3001";
      const protocol = request.protocol;
      const baseUrl = process.env.PUBLIC_API_URL ?? `${protocol}://${host}`;
      recording.audio_uri = audioPublicUrl(baseUrl, recording.id, ext);

      runTranscription(fastify.store, recording.id, filePath).catch((err) => {
        fastify.log.error(err, "Transcription failed");
      });

      return reply.code(201).send({ recording });
    }
  );

  fastify.get(
    "/:projectId/recordings",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const recordings = await fastify.store.listRecordings(
        request.userId!,
        projectId
      );
      return reply.send({ recordings });
    }
  );
}
