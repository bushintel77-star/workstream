import { createReadStream, existsSync } from "fs";
import path from "path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../plugins/auth";
import { verifyPortalToken } from "../lib/magic-link";
import { containedPath } from "../lib/safe-path";

type AssetKind = "uploads" | "outputs" | "photos" | "aerial" | "filings";

/**
 * Asset kinds a client quote token may open. Quote tokens exist to show a
 * client their presentation material — outputs, aerial imagery, and site
 * photos. Operator recordings (uploads) and private operator filings must
 * stay authenticated; a client link is not an operator session.
 */
const QUOTE_VIEW_ASSET_KINDS: ReadonlySet<AssetKind> = new Set([
  "outputs",
  "aerial",
  "photos",
]);

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
    if (!QUOTE_VIEW_ASSET_KINDS.has(kind)) {
      reply.code(403).send({
        error: "Token scope does not allow this asset kind",
      });
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
  /* Never trust the raw URL param in the join — a decoded `%2F` traversal
   * survives basename-based parsing upstream. Serve only the sanitized base
   * name, and only when the resolved path stays inside the kind's root. */
  const base = path.basename(filename);
  const filePath = containedPath(DATA_ROOT, kind, base);
  if (!filePath || base.includes("..")) {
    return reply.code(400).send({ error: "Invalid filename" });
  }
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
  ): Promise<FastifyReply | void> {
    const { filename } = request.params as { filename: string };
    const parsed = parseFilename(filename);
    if (!parsed) {
      return reply.code(400).send({ error: "Invalid filename" });
    }

    const auth = await authorizeAsset(request, reply, kind, parsed.assetId);
    if (!auth) return;

    /* Return the reply: in an async handler, a stream sent as a bare
     * statement after an await makes the handler resolve with undefined as
     * the payload — Fastify then closes the reply as an empty 200 and the
     * stream is never piped (reproduced: /outputs/*.html served 0 bytes).
     * Returning the reply hands the stream back to the framework. */
    return sendAssetFile(reply, kind, filename, parsed.ext);
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
