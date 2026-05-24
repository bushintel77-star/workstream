import Fastify from "fastify";
import { createMemoryStore } from "@workstream/db";
import healthRoutes from "../routes/health";
import projectRoutes from "../routes/projects";
import pipelineRoutes from "../routes/pipeline";
import surveyRoutes from "../routes/surveys";
import taskRoutes from "../routes/tasks";

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
  await app.register(pipelineRoutes, { prefix: "/projects" });
  await app.register(surveyRoutes, { prefix: "/projects" });
  await app.register(taskRoutes, { prefix: "/projects" });
  await app.ready();
  return { app, store };
}
