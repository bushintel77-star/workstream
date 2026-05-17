import path from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import authPlugin from './plugins/auth';
import storePlugin from './plugins/store';
import healthRoutes from './routes/health';
import projectRoutes from './routes/projects';
import recordingRoutes from './routes/recordings';
import settingsRoutes from './routes/settings';
import surveyRoutes from './routes/surveys';
import designRoutes from './routes/designs';
import costingRoutes from './routes/costings';
import auditRoutes from './routes/audits';

const server = Fastify({ logger: true });

async function start() {
  await server.register(cors, { origin: true });
  await server.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 },
  });
  await server.register(fastifyStatic, {
    root: path.join(process.cwd(), 'data', 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });
  await server.register(websocket);
  await server.register(authPlugin);
  await server.register(storePlugin);
  await server.register(healthRoutes);
  await server.register(projectRoutes, { prefix: '/projects' });
  await server.register(recordingRoutes, { prefix: '/projects' });
  await server.register(surveyRoutes, { prefix: '/projects' });
  await server.register(designRoutes, { prefix: '/projects' });
  await server.register(costingRoutes, { prefix: '/projects' });
  await server.register(auditRoutes, { prefix: '/projects' });
  await server.register(settingsRoutes, { prefix: '/settings' });

  const port = Number(process.env.PORT) || 3001;
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`API listening on http://0.0.0.0:${port}`);
}

start().catch((err) => {
  server.log.error(err);
  process.exit(1);
});

const shutdown = async () => {
  await server.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
