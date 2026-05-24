import { createReadStream, existsSync } from "fs";
import path from "path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../plugins/auth";
import { verifyPortalToken } from "../lib/magic-link";

type AssetKind = "uploads" | "outputs" | "photos" | "aerial" | "filings";

const DATA_ROOT = path.join(process.cwd(), "data");

function contentTypeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case "html":
      return "text/html; charset=utf-8";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function parseFilename(raw: string): { assetId: string; ext: string } | null {
  const base = path.basename(raw);
  if (!base || base.includes("..")) return null;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  return { assetId: base.slice(0, dot), ext: base.slice(dot + 1) };
}

async function authorizeAsset(
  request: FastifyRequest,
  reply: FastifyReply,
  kind: AssetKind,
  assetId: string,
): Promise<{ ownerId: string } | null> {
  const tokenRaw = (request.query as { token?: string }).token;
  if (!tokenRaw && !request.userId) {
    await requireAuth(request, reply);
    if (reply.sent) return null;
  }

  const resolved = await request.server.store.resolveAssetOwner(kind, assetId);
  if (!resolved) {
    reply.code(404).send({ error: "File not found" });
    return null;
  }

  if (tokenRaw) {
    const verify = verifyPortalToken(tokenRaw);
    if (!verify.ok) {
      reply.code(401).send({ error: verify.reason });
      return null;
    }
    if (verify.payload.project_id !== resolved.projectId) {
      reply.code(403).send({ error: "Token does not match this asset" });
      return null;
    }
    if (verify.payload.scope !== "quote_view") {
      reply.code(403).send({ error: "Token scope does not allow file access" });
      return null;
    }
    return { ownerId: resolved.ownerId };
  }

  if (request.userId !== resolved.ownerId) {
    reply.code(403).send({ error: "Forbidden" });
    return null;
  }

  return { ownerId: resolved.ownerId };
}

function sendAssetFile(
  reply: FastifyReply,
  kind: AssetKind,
  filename: string,
  ext: string,
): FastifyReply | void {
  const filePath = path.join(DATA_ROOT, kind, filename);
  if (!existsSync(filePath)) {
    return reply.code(404).send({ error: "File not found on disk" });
  }
  return reply
    .header("Content-Type", contentTypeFor(ext))
    .header("Cache-Control", "private, max-age=3600")
    .send(createReadStream(filePath));
}

export default async function protectedFileRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  async function handle(
    request: FastifyRequest,
    reply: FastifyReply,
    kind: AssetKind,
  ): Promise<void> {
    const { filename } = request.params as { filename: string };
    const parsed = parseFilename(filename);
    if (!parsed) {
      reply.code(400).send({ error: "Invalid filename" });
      return;
    }

    const auth = await authorizeAsset(request, reply, kind, parsed.assetId);
    if (!auth) return;

    sendAssetFile(reply, kind, filename, parsed.ext);
  }

  for (const kind of [
    "uploads",
    "outputs",
    "photos",
    "aerial",
    "filings",
  ] as const) {
    fastify.get(`/${kind}/:filename`, (request, reply) =>
      handle(request, reply, kind),
    );
  }
}
