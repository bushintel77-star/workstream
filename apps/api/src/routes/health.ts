import { FastifyInstance } from "fastify";
import { access, constants, writeFile, unlink } from "fs/promises";
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
  const probe = path.join(dir, `.readyz-write-${process.pid}`);
  try {
    await access(dir, constants.W_OK);
    await writeFile(probe, "ok", "utf8");
    await unlink(probe).catch(() => undefined);
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
  app.get("/healthz", async (_req, reply) => {
    const dur = durabilityStatus();
    const prod = process.env.NODE_ENV === "production";
    const writableOk = dur.dbWritable || !prod;
    const body = {
      status: writableOk ? ("ok" as const) : ("degraded" as const),
      ok: writableOk,
      buildSha: buildSha(),
      dbWritable: dur.dbWritable,
      records: dur.records,
      timestamp: new Date().toISOString(),
    };
    /* Liveness must fail when the durability volume is read-only in prod —
     * otherwise Railway keeps routing traffic to a non-durable instance. */
    return reply.code(writableOk ? 200 : 503).send(body);
  });

  app.get("/readyz", async (_req, reply) => {
    const dur = durabilityStatus();
    const checks: Record<string, boolean> = {
      store: !!app.store,
      persist_dir: await persistDirWritable(),
      db_writable: dur.dbWritable || process.env.NODE_ENV !== "production",
      clerk: !isAuthRequired() || !!process.env.CLERK_SECRET_KEY,
      public_api_url: !!process.env.PUBLIC_API_URL,
      cors_origin: !!process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== "*",
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
      records: dur.records,
      timestamp: new Date().toISOString(),
    });
  });
}
