import Fastify from "fastify";
import { createMemoryStore } from "@workstream/db";
import healthRoutes from "../routes/health";
import projectRoutes from "../routes/projects";

/** Minimal Fastify app for route-level contract tests (dev auth). */
export async function buildTestApp() {
  process.env.AUTH_REQUIRED = "false";
  delete process.env.CLERK_SECRET_KEY;

  const store = createMemoryStore();
  await store.seedDefaults();

  const app = Fastify({ logger: false });
  app.decorate("store", store);
  await app.register(healthRoutes);
  await app.register(projectRoutes, { prefix: "/projects" });
  await app.ready();
  return { app, store };
}
