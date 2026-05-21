import { access } from "fs/promises";
import path from "path";
import { FastifyInstance } from "fastify";
import { isAuthRequired } from "../lib/auth-config";

async function persistDirWritable(): Promise<boolean> {
  const dir = path.dirname(
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

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async () => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  }));

  app.get("/readyz", async (_req, reply) => {
    const checks: Record<string, boolean> = {
      store: !!app.store,
      persist_dir: await persistDirWritable(),
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
      timestamp: new Date().toISOString(),
    });
  });
}
