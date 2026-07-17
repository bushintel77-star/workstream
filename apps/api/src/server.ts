import path from 'path';
import fs from 'fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { loadEnv } from './env';
import { assertAuthConfigured } from './lib/auth-config';
import { captureError, initSentry } from './lib/sentry';
import { initTelemetry, registerRouteTelemetry, shutdownTelemetry } from './lib/telemetry';
import authPlugin from './plugins/auth';
import requestIdPlugin from './plugins/request-id';
import storePlugin from './plugins/store';
import healthRoutes from './routes/health';
import projectRoutes from './routes/projects';
import recordingRoutes from './routes/recordings';
import settingsRoutes from './routes/settings';
import surveyRoutes from './routes/surveys';
import designRoutes from './routes/designs';
import costingRoutes from './routes/costings';
import auditRoutes from './routes/audits';
import outputRoutes from './routes/outputs';
import overrideRoutes from './routes/overrides';
import geocodeRoutes from './routes/geocode';
import pipelineRoutes from './routes/pipeline';
import taskRoutes from './routes/tasks';
import dictationRoutes from './routes/dictation';
import myobRoutes from './routes/myob';
import crewRoutes from './routes/crew';
import weatherRoutes from './routes/weather';
import siteContextRoutes from './routes/site-context';
import measurementRoutes from './routes/measurements';
import supplierRoutes from './routes/suppliers';
import aerialRoutes from './routes/aerial';
import xeroRoutes from './routes/xero';
import carbonRoutes from './routes/carbon';
import catalogRoutes from './routes/catalog';
import designCanvasRoutes from './routes/design-canvas';
import designGhostsRoutes from './routes/design-ghosts';
import cadRoutes from './routes/cad';
import projectFileRoutes from './routes/project-files';
import activityRoutes from './routes/activity';
import portalRoutes from './routes/portal';
import stripeWebhookRoutes from './routes/stripe-webhook';
import integrationHubRoutes, {
  registerProjectIntegrationRoutes,
} from './routes/integration-hub';
import protectedFileRoutes from './routes/protected-files';

const server = Fastify({ logger: true });

loadEnv({
  warn: (m) => server.log.warn(m),
  error: (m) => server.log.error(m),
});
assertAuthConfigured();

function resolveCorsOrigin(): boolean | string | string[] {
  const raw = process.env.CORS_ORIGIN;
  if (raw == null || raw === "") {
    if (process.env.NODE_ENV === "production") {
      server.log.warn(
        "CORS_ORIGIN unset in production — refusing all cross-origin requests. Set CORS_ORIGIN to an explicit comma-separated allowlist.",
      );
      return false;
    }
    return true; // dev convenience
  }
  if (raw === "*") return true;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function start() {
  await server.register(helmet, {
    /* The API serves JSON + the occasional static file (uploads, branded
     * HTML outputs at /outputs/*). A real CSP is enforced on the Next.js
     * client portal instead — keeping it off here so the rendered HTML
     * outputs (which inline styles) load cleanly. */
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  await server.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? "1 minute",
    keyGenerator: (req) => {
      /* Prefer authenticated user, fall back to remote IP. Keeps a
       * shared office on Tim's WiFi from collectively tripping the
       * limit when one ratbag automates the dashboard. */
      return req.userId ?? req.ip;
    },
    skipOnError: true,
    enableDraftSpec: true,
  });

  await server.register(cors, { origin: resolveCorsOrigin(), credentials: true });
  await server.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  for (const dir of ['uploads', 'outputs', 'photos', 'aerial', 'filings']) {
    fs.mkdirSync(path.join(process.cwd(), 'data', dir), { recursive: true });
  }

  await server.register(websocket);
  await server.register(requestIdPlugin);
  await server.register(authPlugin);
  await server.register(storePlugin);
  registerRouteTelemetry(server);
  await server.register(protectedFileRoutes);
  await server.register(healthRoutes);
  await server.register(projectRoutes, { prefix: '/projects' });
  await server.register(recordingRoutes, { prefix: '/projects' });
  await server.register(surveyRoutes, { prefix: '/projects' });
  await server.register(designRoutes, { prefix: '/projects' });
  await server.register(costingRoutes, { prefix: '/projects' });
  await server.register(auditRoutes, { prefix: '/projects' });
  await server.register(outputRoutes, { prefix: '/projects' });
  await server.register(overrideRoutes, { prefix: '/projects' });
  await server.register(geocodeRoutes, { prefix: '/geocode' });
  await server.register(pipelineRoutes, { prefix: '/projects' });
  await server.register(taskRoutes, { prefix: '/projects' });
  await server.register(dictationRoutes, { prefix: '/projects' });
  await server.register(myobRoutes, { prefix: '/myob' });
  await server.register(crewRoutes, { prefix: '/crew' });
  await server.register(weatherRoutes, { prefix: '/projects' });
  await server.register(siteContextRoutes, { prefix: '/projects' });
  await server.register(measurementRoutes, { prefix: '/projects' });
  await server.register(supplierRoutes, { prefix: '/suppliers' });
  await server.register(aerialRoutes, { prefix: '/projects' });
  await server.register(xeroRoutes, { prefix: '/xero' });
  await server.register(carbonRoutes, { prefix: '/projects' });
  await server.register(catalogRoutes, { prefix: '/catalog' });
  await server.register(designCanvasRoutes, { prefix: '/projects' });
  await server.register(designGhostsRoutes, { prefix: '/projects' });
  await server.register(cadRoutes, { prefix: '/projects' });
  await server.register(projectFileRoutes, { prefix: '/projects' });
  await server.register(activityRoutes, { prefix: '/projects' });
  await server.register(portalRoutes);
  await server.register(stripeWebhookRoutes);
  await server.register(settingsRoutes, { prefix: '/settings' });
  await server.register(integrationHubRoutes, { prefix: '/integrations' });
  await server.register(
    async (scope) => {
      await registerProjectIntegrationRoutes(scope);
    },
    { prefix: '/projects' },
  );

  const port = Number(process.env.PORT) || 3001;
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`API listening on http://0.0.0.0:${port}`);
}

initTelemetry();
void initSentry();

server.setErrorHandler((err: Error & { statusCode?: number }, request, reply) => {
  captureError(err, {
    method: request.method,
    url: request.url,
    requestId: request.id,
  });
  request.log.error(err);
  if (!reply.sent) {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    reply.code(status).send({ error: err.message || "Internal error" });
  }
});

start().catch((err) => {
  server.log.error(err);
  captureError(err, { phase: "startup" });
  process.exit(1);
});

const shutdown = async () => {
  await server.close();
  await shutdownTelemetry();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
