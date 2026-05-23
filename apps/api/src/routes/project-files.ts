import { FastifyInstance } from "fastify";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import {
  ProjectFileKindSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { scanImageContact } from "../lib/claude";
import {
  buildProjectGallery,
  isGalleryImageMime,
  viewableGalleryItems,
} from "../lib/project-gallery";
import { publicBaseUrl } from "../lib/public-url";

const FILINGS_DIR = path.join(process.cwd(), "data", "filings");

function mimeOf(filename: string, contentType?: string): string | null {
  if (contentType?.includes("png")) return "image/png";
  if (contentType?.includes("webp")) return "image/webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg"))
    return "image/jpeg";
  if (contentType?.includes("pdf")) return "application/pdf";
  if (/\.png$/i.test(filename)) return "image/png";
  if (/\.webp$/i.test(filename)) return "image/webp";
  if (/\.(jpe?g)$/i.test(filename)) return "image/jpeg";
  if (/\.pdf$/i.test(filename)) return "application/pdf";
  return null;
}

function extOf(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  return "jpg";
}

export default async function projectFileRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/gallery",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await fastify.store.getProject(ownerId, projectId);
      if (!project) return reply.code(404).send({ error: "Project not found" });
      const items = await buildProjectGallery(fastify.store, ownerId, projectId);
      return reply.send({
        items,
        viewable: viewableGalleryItems(items),
      });
    },
  );

  fastify.get(
    "/:projectId/files",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const files = await fastify.store.listProjectFiles(
        request.userId!,
        projectId,
      );
      return reply.send({ files });
    },
  );

  fastify.post(
    "/:projectId/files",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await fastify.store.getProject(ownerId, projectId);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const file = await request.file();
      if (!file) return reply.code(400).send({ error: "No file uploaded" });

      const mime = mimeOf(file.filename ?? "", file.mimetype);
      if (!mime) {
        return reply.code(415).send({
          error: "Use JPEG, PNG, WEBP, or PDF",
        });
      }

      const kindField = file.fields.kind;
      const titleField = file.fields.title;
      const kindRaw =
        kindField && "value" in kindField && typeof kindField.value === "string"
          ? kindField.value
          : "other";
      const kindParsed = ProjectFileKindSchema.safeParse(kindRaw);
      const kind = kindParsed.success ? kindParsed.data : "other";
      const title =
        titleField && "value" in titleField && typeof titleField.value === "string"
          ? titleField.value.trim()
          : file.filename ?? "Upload";

      const buffer = await file.toBuffer();
      await mkdir(FILINGS_DIR, { recursive: true });
      const fileId = crypto.randomUUID();
      const ext = extOf(mime);
      await writeFile(path.join(FILINGS_DIR, `${fileId}.${ext}`), buffer);

      let baseUrl: string;
      try {
        baseUrl = publicBaseUrl(request);
      } catch (err) {
        request.log.error(err);
        return reply
          .code(500)
          .send({ error: "Server misconfigured: PUBLIC_API_URL not set" });
      }
      const uri = `${baseUrl}/filings/${fileId}.${ext}`;

      const row = await fastify.store.createProjectFile(ownerId, projectId, {
        kind,
        title,
        mime_type: mime,
        uri,
      });

      return reply.code(201).send({ file: row });
    },
  );

  fastify.post(
    "/:projectId/files/scan-contact",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await fastify.store.getProject(ownerId, projectId);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const file = await request.file();
      if (!file) return reply.code(400).send({ error: "No image uploaded" });

      const mime = mimeOf(file.filename ?? "", file.mimetype);
      if (!mime || !isGalleryImageMime(mime)) {
        return reply.code(415).send({ error: "Contact scan needs JPEG, PNG, or WEBP" });
      }

      const buffer = await file.toBuffer();
      const base64 = buffer.toString("base64");

      try {
        const scan = await scanImageContact({
          image_base64: base64,
          mime_type: mime as "image/jpeg" | "image/png" | "image/webp",
        });

        const patch: {
          client_name?: string | null;
          client_email?: string | null;
        } = {};
        if (scan.client_name) patch.client_name = scan.client_name;
        if (scan.client_email) patch.client_email = scan.client_email;
        if (patch.client_name || patch.client_email) {
          await fastify.store.updateProjectClient(ownerId, projectId, patch);
        }

        return reply.send({
          scan,
          applied: !!(patch.client_name || patch.client_email),
          note: "Email is saved to the client record only — quote emails stay plain text, images stay in Filing.",
        });
      } catch (err) {
        request.log.error(err, "contact scan failed");
        return reply.code(502).send({ error: "Contact scan failed" });
      }
    },
  );

  fastify.delete(
    "/:projectId/files/:fileId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, fileId } = request.params as {
        projectId: string;
        fileId: string;
      };
      const ownerId = request.userId!;
      const files = await fastify.store.listProjectFiles(ownerId, projectId);
      const row = files.find((f) => f.id === fileId);
      if (!row) return reply.code(404).send({ error: "File not found" });

      const ok = await fastify.store.deleteProjectFile(
        ownerId,
        projectId,
        fileId,
      );
      if (ok) {
        const ext = extOf(row.mime_type);
        const disk = path.join(FILINGS_DIR, `${fileId}.${ext}`);
        await unlink(disk).catch(() => {});
      }
      return reply.code(ok ? 204 : 404).send();
    },
  );
}
