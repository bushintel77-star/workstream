import { FastifyInstance } from "fastify";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requireAuth } from "../plugins/auth";
import { measurePhoto } from "../lib/claude";
import { publicBaseUrl } from "../lib/public-url";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");

function mimeOf(filename: string, contentType?: string):
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | null {
  if (contentType?.includes("png")) return "image/png";
  if (contentType?.includes("webp")) return "image/webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg"))
    return "image/jpeg";
  if (/\.png$/i.test(filename)) return "image/png";
  if (/\.webp$/i.test(filename)) return "image/webp";
  if (/\.(jpe?g)$/i.test(filename)) return "image/jpeg";
  return null;
}

export default async function measurementRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/measurements",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const measurements = await fastify.store.listPhotoMeasurements(
        ownerId,
        projectId,
      );
      return reply.send({ measurements });
    },
  );

  fastify.post(
    "/:projectId/measurements/photo",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;

      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);

      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: "No photo uploaded" });
      }
      const mime = mimeOf(file.filename ?? "", file.mimetype);
      if (!mime) {
        return reply
          .code(415)
          .send({ error: "Unsupported image type. Use JPEG, PNG, or WEBP." });
      }

      const hintField = file.fields.hint;
      const hint =
        hintField && "value" in hintField && typeof hintField.value === "string"
          ? hintField.value
          : undefined;

      const buffer = await file.toBuffer();
      const base64 = buffer.toString("base64");

      let result;
      try {
        result = await measurePhoto({
          image_base64: base64,
          mime_type: mime,
          user_hint: hint,
        });
      } catch (err) {
        request.log.error(err, "vision measurement failed");
        return reply
          .code(502)
          .send({ error: "Vision measurement failed" });
      }

      // Save image so the measurement row can be reviewed later.
      await mkdir(PHOTOS_DIR, { recursive: true });
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const imageId = crypto.randomUUID();
      const filePath = path.join(PHOTOS_DIR, `${imageId}.${ext}`);
      await writeFile(filePath, buffer);

      let baseUrl: string;
      try {
        baseUrl = publicBaseUrl(request);
      } catch (err) {
        request.log.error(err);
        return reply
          .code(500)
          .send({ error: "Server misconfigured: PUBLIC_API_URL not set" });
      }
      const imageUri = `${baseUrl}/photos/${imageId}.${ext}`;

      const measurement = await fastify.store.createPhotoMeasurement(
        ownerId,
        projectId,
        {
          project_id: projectId,
          image_uri: imageUri,
          items: result.items,
          notes: result.notes,
        },
      );
      return reply.code(201).send({ measurement });
    },
  );
}
