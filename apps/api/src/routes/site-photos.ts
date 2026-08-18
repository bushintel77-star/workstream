import { FastifyInstance } from "fastify";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { SitePhotoSchema } from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { publicBaseUrl } from "../lib/public-url";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

/**
 * Site-photo gallery — the on-site photos that feed photo-trace elevation.
 *
 * Distinct from the survey aerial (drone/replacement imagery): a site visit
 * produces several photos (street frontage, rear fence, side boundary) and
 * each can be pinned as a calibrated camera frame on the canvas.
 *
 * Files live under `data/photos/` and are served by the protected-file route
 * (`/photos/:filename`) with owner + portal-token authorisation — the
 * `resolveAssetOwner("photos")` store lookup knows both photo-measurement
 * rows and this gallery.
 */
const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");

const MAX_PHOTOS = 50;

export default async function sitePhotoRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/site-photos",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const survey = await fastify.store.getSurvey(ownerId, projectId);
      // Pre-gallery surveys predate the field — treat as empty, not an error.
      return reply.send({ photos: survey?.site_photos ?? [] });
    },
  );

  fastify.post(
    "/:projectId/site-photos/upload",
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
          .send({ error: "Run survey first; site photos attach to the survey record." });
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
          .send({ error: "Site photos must be JPEG or PNG" });
      }

      // The browser measures the image's natural aspect at upload — the
      // server has no image decoder, and the client value is authoritative.
      const fields = (file.fields ??
        {}) as Record<string, { value?: unknown } | undefined>;
      const aspectRaw = fields.natural_aspect?.value;
      const aspect = typeof aspectRaw === "string" ? Number(aspectRaw) : NaN;
      if (!Number.isFinite(aspect) || aspect <= 0 || aspect > 100) {
        return reply.code(400).send({
          error: "natural_aspect (width / height) is required and must be positive",
        });
      }

      const existing = survey.site_photos ?? [];
      if (existing.length >= MAX_PHOTOS) {
        return reply
          .code(409)
          .send({ error: `Gallery is full (${MAX_PHOTOS} photos)` });
      }

      const buffer = await file.toBuffer();
      await mkdir(PHOTOS_DIR, { recursive: true });
      const ext = isPng ? "png" : "jpg";
      const fileId = crypto.randomUUID();
      await writeFile(path.join(PHOTOS_DIR, `${fileId}.${ext}`), buffer);

      let baseUrl: string;
      try {
        baseUrl = publicBaseUrl(request);
      } catch (err) {
        request.log.error(err);
        return reply
          .code(500)
          .send({ error: "Server misconfigured: PUBLIC_API_URL not set" });
      }

      const photo = SitePhotoSchema.parse({
        id: fileId,
        name:
          typeof fields.name?.value === "string" && fields.name.value.trim()
            ? fields.name.value.trim().slice(0, 200)
            : (file.filename ?? "Site photo").slice(0, 200),
        uri: `${baseUrl}/photos/${fileId}.${ext}`,
        natural_aspect: aspect,
        created_at: new Date().toISOString(),
      });

      const updated = await fastify.store.upsertSurvey(ownerId, projectId, {
        ...survey,
        site_photos: [...existing, photo],
      });

      return reply.code(201).send({ photo, survey: updated });
    },
  );

  fastify.delete(
    "/:projectId/site-photos/:photoId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, photoId } = request.params as {
        projectId: string;
        photoId: string;
      };
      const ownerId = request.userId!;

      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const survey = await fastify.store.getSurvey(ownerId, projectId);
      const photos = survey?.site_photos ?? [];
      const photo = photos.find((p) => p.id === photoId);
      if (!photo) {
        return reply.code(404).send({ error: "Photo not found" });
      }

      // A pinned photo owns a live elevation trace — deleting the source
      // would orphan real work. Refuse until the elevation is removed.
      const canvas = await fastify.store.getDesignCanvas(ownerId, projectId);
      const pinned = (canvas?.photo_elevations ?? []).some(
        (elev) => elev.photo_id === photoId,
      );
      if (pinned) {
        return reply.code(409).send({
          error: "Photo is pinned to a photo elevation — remove the elevation first.",
        });
      }

      const basename = path.basename(photo.uri);
      await unlink(path.join(PHOTOS_DIR, basename)).catch(() => undefined);

      const updated = await fastify.store.upsertSurvey(ownerId, projectId, {
        ...survey!,
        site_photos: photos.filter((p) => p.id !== photoId),
      });

      return reply.send({ ok: true, survey: updated });
    },
  );
}
