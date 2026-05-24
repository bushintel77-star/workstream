import { FastifyInstance } from "fastify";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requireAuth } from "../plugins/auth";
import { publicBaseUrl } from "../lib/public-url";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

const AERIAL_DIR = path.join(process.cwd(), "data", "aerial");

export default async function aerialRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/aerial/upload",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;

      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const survey = await fastify.store.getSurvey(ownerId, projectId);
      if (!survey) {
        return reply
          .code(409)
          .send({ error: "Run survey first; drone imagery replaces the auto aerial." });
      }

      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: "No image uploaded" });
      }
      const isPng = file.mimetype?.includes("png");
      const isJpg =
        file.mimetype?.includes("jpeg") || file.mimetype?.includes("jpg");
      if (!isPng && !isJpg) {
        return reply
          .code(415)
          .send({ error: "Drone imagery must be JPEG or PNG" });
      }

      const buffer = await file.toBuffer();
      await mkdir(AERIAL_DIR, { recursive: true });
      const ext = isPng ? "png" : "jpg";
      const fileId = crypto.randomUUID();
      await writeFile(path.join(AERIAL_DIR, `${fileId}.${ext}`), buffer);

      let baseUrl: string;
      try {
        baseUrl = publicBaseUrl(request);
      } catch (err) {
        request.log.error(err);
        return reply
          .code(500)
          .send({ error: "Server misconfigured: PUBLIC_API_URL not set" });
      }
      const aerialUri = `${baseUrl}/aerial/${fileId}.${ext}`;

      const updated = await fastify.store.upsertSurvey(ownerId, projectId, {
        ...survey,
        aerial_uri: aerialUri,
      });

      return reply.code(201).send({ survey: updated });
    },
  );
}
