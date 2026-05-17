import { FastifyInstance } from "fastify";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async () => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  }));

  app.get("/readyz", async () => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  }));
}
