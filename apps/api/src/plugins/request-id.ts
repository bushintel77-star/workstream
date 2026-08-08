import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

/**
 * Request-id middleware. Reads X-Request-Id from upstream (Railway /
 * legacy Fly-Request-Id), otherwise generates a UUID. Attaches it to the
 * Fastify logger as `reqId` and echoes it back to the client so every log
 * line on either side carries the same correlation id.
 */
export default fp(
  async function requestIdPlugin(fastify: FastifyInstance) {
    fastify.addHook("onRequest", async (request, reply) => {
      const incoming =
        (request.headers["x-request-id"] as string | undefined) ??
        (request.headers["x-correlation-id"] as string | undefined) ??
        (request.headers["fly-request-id"] as string | undefined) ??
        crypto.randomUUID();
      const reqId = incoming.slice(0, 64);
      reply.header("x-request-id", reqId);
      // Replace Fastify's logger with one bound to this request id.
      request.log = request.log.child({ reqId });
    });
  },
  { name: "request-id" },
);
