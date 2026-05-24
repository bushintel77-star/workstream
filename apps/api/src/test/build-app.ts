import Fastify from "fastify";
import { createMemoryStore } from "@workstream/db";
import healthRoutes from "../routes/health";
import projectRoutes from "../routes/projects";
import pipelineRoutes from "../routes/pipeline";
import surveyRoutes from "../routes/surveys";
import taskRoutes from "../routes/tasks";
import designRoutes from "../routes/designs";
import costingRoutes from "../routes/costings";
import outputRoutes from "../routes/outputs";
import activityRoutes from "../routes/activity";
import crewRoutes from "../routes/crew";
import settingsRoutes from "../routes/settings";

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
  await app.register(designRoutes, { prefix: "/projects" });
  await app.register(costingRoutes, { prefix: "/projects" });
  await app.register(outputRoutes, { prefix: "/projects" });
  await app.register(activityRoutes, { prefix: "/projects" });
  await app.register(crewRoutes, { prefix: "/crew" });
  await app.register(settingsRoutes, { prefix: "/settings" });
  await app.ready();
  return { app, store };
}
