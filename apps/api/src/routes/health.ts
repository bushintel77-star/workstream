import { FastifyInstance } from "fastify";
import { access } from "fs/promises";
import path from "path";
import { durabilityStatus } from "@workstream/db";
import { isAuthRequired } from "../lib/auth-config";

async function persistDirWritable(): Promise<boolean> {
  const dir = path.dirname(
    process.env.WORKSTREAM_SQLITE_PATH ??
      process.env.CONSTRUCT_SQLITE_PATH ??
      process.env.WORKSTREAM_PERSIST_PATH ??
      process.env.CONSTRUCT_PERSIST_PATH ??
      path.join(process.cwd(), "data", "store.json"),
  );
  try {
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

function buildSha(): string {
  return (
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.RAILWAY_GIT_COMMIT_SHA_SHORT ??
    process.env.BUILD_SHA ??
    process.env.GIT_COMMIT_SHA ??
    "unknown"
  );
}

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async () => {
    const dur = durabilityStatus();
    return {
      status: "ok" as const,
      ok: true as const,
      buildSha: buildSha(),
      dbPath: dur.dbPath,
      dbWritable: dur.dbWritable,
      records: dur.records,
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/readyz", async (_req, reply) => {
    const dur = durabilityStatus();
    const checks: Record<string, boolean> = {
      store: !!app.store,
      persist_dir: await persistDirWritable(),
      db_writable: dur.dbWritable || process.env.NODE_ENV !== "production",
      clerk: !isAuthRequired() || !!process.env.CLERK_SECRET_KEY,
      public_api_url: !!process.env.PUBLIC_API_URL,
      cors_origin: !!process.env.CORS_ORIGIN,
      portal_secret: !!(
        process.env.WORKSTREAM_PORTAL_SECRET ??
        process.env.CONSTRUCT_PORTAL_SECRET
      ),
    };

    const ok = Object.values(checks).every(Boolean);
    return reply.code(ok ? 200 : 503).send({
      status: ok ? ("ok" as const) : ("degraded" as const),
      checks,
      buildSha: buildSha(),
      dbPath: dur.dbPath,
      records: dur.records,
      timestamp: new Date().toISOString(),
    });
  });
}
