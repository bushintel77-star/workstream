import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  context,
  SpanKind,
  SpanStatusCode,
  trace,
  type Span,
  type SpanAttributes,
  type SpanAttributeValue,
} from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

type TelemetryEnv = {
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
};

type TelemetrySdk = {
  start(): void | Promise<void>;
  shutdown(): void | Promise<void>;
};

type TelemetryFactoryArgs = {
  traceUrl: string;
};

type TelemetryFactory = (args: TelemetryFactoryArgs) => TelemetrySdk;

type InitTelemetryOptions = {
  env?: TelemetryEnv;
  sdkFactory?: TelemetryFactory;
};

declare module "fastify" {
  interface FastifyRequest {
    telemetrySpan?: Span;
  }
}

let telemetrySdk: TelemetrySdk | null = null;
let telemetryStarted = false;

function normaliseTraceUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/v1/traces") ? trimmed : `${trimmed}/v1/traces`;
}

function createSdk({ traceUrl }: TelemetryFactoryArgs): TelemetrySdk {
  return new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: traceUrl }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
}

export function initTelemetry(options: InitTelemetryOptions = {}): {
  enabled: boolean;
  started: boolean;
  traceUrl?: string;
} {
  const endpoint = options.env?.OTEL_EXPORTER_OTLP_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint?.trim()) {
    return { enabled: false, started: false };
  }

  const traceUrl = normaliseTraceUrl(endpoint);
  if (telemetryStarted) {
    return { enabled: true, started: false, traceUrl };
  }

  const factory = options.sdkFactory ?? createSdk;
  telemetrySdk = factory({ traceUrl });
  void telemetrySdk.start();
  telemetryStarted = true;

  return { enabled: true, started: true, traceUrl };
}

export async function shutdownTelemetry(): Promise<void> {
  if (!telemetrySdk) return;
  await telemetrySdk.shutdown();
  telemetrySdk = null;
  telemetryStarted = false;
}

export function resetTelemetryForTest(): void {
  telemetrySdk = null;
  telemetryStarted = false;
}

function cleanAttributes(
  attributes: Record<string, SpanAttributeValue | null | undefined>,
): SpanAttributes {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, SpanAttributeValue] => entry[1] != null,
    ),
  );
}

export function setTelemetryAttributes(
  span: Span,
  attributes: Record<string, SpanAttributeValue | null | undefined>,
): void {
  span.setAttributes(cleanAttributes(attributes));
}

export function setActiveTelemetryAttributes(
  attributes: Record<string, SpanAttributeValue | null | undefined>,
): void {
  const span = trace.getActiveSpan();
  if (span) setTelemetryAttributes(span, attributes);
}

export async function withTelemetrySpan<T>(
  name: string,
  attributes: Record<string, SpanAttributeValue | null | undefined>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer("workstream-api");
  return await tracer.startActiveSpan(
    name,
    { kind: SpanKind.CLIENT, attributes: cleanAttributes(attributes) },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        if (err instanceof Error) {
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        } else {
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
        throw err;
      } finally {
        span.end();
      }
    },
  );
}

function projectIdFromRequest(request: FastifyRequest): string | undefined {
  const params = request.params;
  if (params && typeof params === "object") {
    const record = params as Record<string, unknown>;
    const candidate = record.projectId ?? record.id;
    return typeof candidate === "string" ? candidate : undefined;
  }
  return undefined;
}

function pathnameFromRequest(request: FastifyRequest): string {
  try {
    return new URL(request.url, "http://workstream.local").pathname;
  } catch {
    return request.url.split("?")[0] ?? request.url;
  }
}

export function registerRouteTelemetry(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", (request, _reply, done) => {
    const pathname = pathnameFromRequest(request);
    const span = trace.getTracer("workstream-api").startSpan(
      `api ${request.method} ${pathname}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          "http.request.method": request.method,
          "url.path": pathname,
        },
      },
    );
    request.telemetrySpan = span;
    context.with(trace.setSpan(context.active(), span), done);
  });

  fastify.addHook("onResponse", (request, reply, done) => {
    const span = request.telemetrySpan;
    if (span) {
      setTelemetryAttributes(span, {
        "http.response.status_code": reply.statusCode,
        "operator.id": request.userId,
        "project.id": projectIdFromRequest(request),
      });
      if (reply.statusCode >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      span.end();
    }
    done();
  });

  fastify.addHook("onError", (request, _reply, error, done) => {
    const span = request.telemetrySpan;
    if (span) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    }
    done();
  });
}

export function annotateActiveSpan(
  attributes: Record<string, SpanAttributeValue | null | undefined>,
): void {
  setActiveTelemetryAttributes(attributes);
}
