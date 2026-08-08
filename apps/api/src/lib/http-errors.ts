import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { ZodError } from "zod";
import { captureError } from "./sentry";

/** Stable client body for unexpected 5xx — never echo internal messages. */
export function internalErrorBody(requestId?: string): {
  error: string;
  requestId?: string;
} {
  return requestId
    ? { error: "Internal error", requestId }
    : { error: "Internal error" };
}

/**
 * Prefer a fixed operator-facing string for 5xx. Known domain messages
 * (404/409 prefixes) stay explicit at the call site.
 */
export function publicServerError(_err: unknown, fallback: string): string {
  return fallback;
}

export function requestIdOf(
  request: FastifyRequest,
  reply?: FastifyReply,
): string {
  const fromHeader =
    (reply?.getHeader("x-request-id") as string | undefined) ||
    (request.headers["x-request-id"] as string | undefined);
  if (fromHeader) return String(fromHeader).slice(0, 64);
  return String(request.id);
}

function zodIssues(err: ZodError): Array<{ path: string; message: string }> {
  return err.issues.slice(0, 20).map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

/**
 * Shared Fastify error + 404 handlers: Zod → 400, 4xx keep message,
 * 5xx always "Internal error", Sentry + request correlation.
 */
export function registerErrorHandlers(server: FastifyInstance): void {
  server.setErrorHandler(
    (err: FastifyError | Error, request, reply) => {
      const requestId = requestIdOf(request, reply);

      if (err instanceof ZodError) {
        request.log.warn({ err, requestId }, "validation failed");
        if (!reply.sent) {
          return reply.code(400).send({
            error: "Validation failed",
            issues: zodIssues(err),
            requestId,
          });
        }
        return;
      }

      const statusCode =
        "statusCode" in err &&
        typeof err.statusCode === "number" &&
        err.statusCode >= 400
          ? err.statusCode
          : 500;

      captureError(err, {
        method: request.method,
        url: request.url,
        requestId,
        statusCode,
      });

      if (statusCode >= 500) {
        request.log.error({ err, requestId }, "request failed");
      } else {
        request.log.warn({ err, requestId }, "request rejected");
      }

      if (!reply.sent) {
        if (statusCode >= 500) {
          return reply.code(statusCode).send(internalErrorBody(requestId));
        }
        return reply.code(statusCode).send({
          error: err.message || "Bad request",
          requestId,
        });
      }
    },
  );

  server.setNotFoundHandler((request, reply) => {
    const requestId = requestIdOf(request, reply);
    return reply.code(404).send({
      error: "Not found",
      requestId,
    });
  });
}

export function registerProcessGuards(server: FastifyInstance): void {
  process.on("unhandledRejection", (reason) => {
    server.log.error({ err: reason }, "unhandledRejection");
    captureError(reason, { phase: "unhandledRejection" });
  });

  process.on("uncaughtException", (err) => {
    server.log.error({ err }, "uncaughtException");
    captureError(err, { phase: "uncaughtException" });
    /* Hard-fail — state may be corrupt after sync throw outside the event loop. */
    process.exit(1);
  });
}
