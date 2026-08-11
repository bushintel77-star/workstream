import Fastify from "fastify";
import { createMemoryStore } from "@workstream/db";
import multipart from "@fastify/multipart";
import { registerErrorHandlers } from "../lib/http-errors";
import healthRoutes from "../routes/health";
import projectRoutes from "../routes/projects";
import pipelineRoutes from "../routes/pipeline";
import surveyRoutes from "../routes/surveys";
import taskRoutes from "../routes/tasks";
import designRoutes from "../routes/designs";
import costingRoutes from "../routes/costings";
import outputRoutes from "../routes/outputs";
import auditRoutes from "../routes/audits";
import overrideRoutes from "../routes/overrides";
import activityRoutes from "../routes/activity";
import crewRoutes from "../routes/crew";
import settingsRoutes from "../routes/settings";
import recordingRoutes from "../routes/recordings";
import voiceIntentRoutes from "../routes/voice-intent";
import geocodeRoutes from "../routes/geocode";
import dictationRoutes from "../routes/dictation";
import myobRoutes from "../routes/myob";
import weatherRoutes from "../routes/weather";
import siteContextRoutes from "../routes/site-context";
import cadastralTitleRoutes from "../routes/cadastral-title";
import measurementRoutes from "../routes/measurements";
import supplierRoutes from "../routes/suppliers";
import aerialRoutes from "../routes/aerial";
import xeroRoutes from "../routes/xero";
import carbonRoutes from "../routes/carbon";
import catalogRoutes from "../routes/catalog";
import designCanvasRoutes from "../routes/design-canvas";
import quoteDocRoutes from "../routes/quote-doc";
import designGhostsRoutes from "../routes/design-ghosts";
import designAssistRoutes from "../routes/design-assist";
import designFindingsRoutes from "../routes/design-findings";
import designBoardReportRoutes from "../routes/design-board-report";
import designTelemetryRoutes from "../routes/design-telemetry";
import cadRoutes from "../routes/cad";
import boundaryRoutes from "../routes/boundary";
import keylessRoutes from "../routes/keyless";
import orchestrationRoutes from "../routes/orchestration";
import projectFileRoutes from "../routes/project-files";
import portalRoutes from "../routes/portal";
import shareRoutes from "../routes/share";
import stripeWebhookRoutes from "../routes/stripe-webhook";
import protectedFileRoutes from "../routes/protected-files";
import designBranchRoutes from "../routes/design-branches";
import opsScheduleRoutes from "../routes/ops-schedules";
import documentationPackageRoutes from "../routes/documentation-packages";
import resourcePoolRoutes from "../routes/resource-pool";
import presentationPackRoutes from "../routes/presentation-pack";
import integrationHubRoutes, {
  registerProjectIntegrationRoutes,
} from "../routes/integration-hub";

type BuildTestAppOptions = {
  authRequired?: boolean;
};

/** Minimal Fastify app for route-level contract tests. */
export async function buildTestApp(options: BuildTestAppOptions = {}) {
  process.env.AUTH_REQUIRED = options.authRequired ? "true" : "false";
  delete process.env.CLERK_SECRET_KEY;

  const store = createMemoryStore();
  await store.seedDefaults();

  const app = Fastify({ logger: false, trustProxy: true });
  registerErrorHandlers(app);
  app.decorate("store", store);
  await app.register(multipart);
  await app.register(protectedFileRoutes);
  await app.register(healthRoutes);
  await app.register(projectRoutes, { prefix: "/projects" });
  await app.register(pipelineRoutes, { prefix: "/projects" });
  await app.register(surveyRoutes, { prefix: "/projects" });
  await app.register(taskRoutes, { prefix: "/projects" });
  await app.register(designRoutes, { prefix: "/projects" });
  await app.register(costingRoutes, { prefix: "/projects" });
  await app.register(outputRoutes, { prefix: "/projects" });
  await app.register(auditRoutes, { prefix: "/projects" });
  await app.register(overrideRoutes, { prefix: "/projects" });
  await app.register(activityRoutes, { prefix: "/projects" });
  await app.register(recordingRoutes, { prefix: "/projects" });
  await app.register(voiceIntentRoutes, { prefix: "/projects" });
  await app.register(dictationRoutes, { prefix: "/projects" });
  await app.register(weatherRoutes, { prefix: "/projects" });
  await app.register(siteContextRoutes, { prefix: "/projects" });
  await app.register(cadastralTitleRoutes, { prefix: "/projects" });
  await app.register(measurementRoutes, { prefix: "/projects" });
  await app.register(aerialRoutes, { prefix: "/projects" });
  await app.register(carbonRoutes, { prefix: "/projects" });
  await app.register(designCanvasRoutes, { prefix: "/projects" });
  await app.register(quoteDocRoutes, { prefix: "/projects" });
  await app.register(designGhostsRoutes, { prefix: "/projects" });
  await app.register(designAssistRoutes, { prefix: "/projects" });
  await app.register(designFindingsRoutes, { prefix: "/projects" });
  await app.register(designBoardReportRoutes, { prefix: "/projects" });
  await app.register(designTelemetryRoutes, { prefix: "/projects" });
  await app.register(cadRoutes, { prefix: "/projects" });
  await app.register(boundaryRoutes, { prefix: "/projects" });
  await app.register(keylessRoutes, { prefix: "/projects" });
  await app.register(orchestrationRoutes, { prefix: "/projects" });
  await app.register(projectFileRoutes, { prefix: "/projects" });
  await app.register(geocodeRoutes, { prefix: "/geocode" });
  await app.register(crewRoutes, { prefix: "/crew" });
  await app.register(myobRoutes, { prefix: "/myob" });
  await app.register(xeroRoutes, { prefix: "/xero" });
  await app.register(supplierRoutes, { prefix: "/suppliers" });
  await app.register(catalogRoutes, { prefix: "/catalog" });
  await app.register(portalRoutes);
  await app.register(shareRoutes);
  await app.register(designBranchRoutes, { prefix: "/projects" });
  await app.register(opsScheduleRoutes, { prefix: "/projects" });
  await app.register(documentationPackageRoutes, { prefix: "/projects" });
  await app.register(presentationPackRoutes, { prefix: "/projects" });
  await app.register(resourcePoolRoutes);
  await app.register(stripeWebhookRoutes);
  await app.register(settingsRoutes, { prefix: "/settings" });
  await app.register(integrationHubRoutes, { prefix: "/integrations" });
  await app.register(
    async (scope) => {
      await registerProjectIntegrationRoutes(scope);
    },
    { prefix: "/projects" },
  );
  await app.ready();
  return { app, store };
}
