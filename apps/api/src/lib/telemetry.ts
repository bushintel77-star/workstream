import {
  SpanStatusCode,
  trace,
  type AttributeValue,
  type Span,
} from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { FastifyRequest } from "fastify";

type TelemetrySdk = Pick<NodeSDK, "start" | "shutdown">;

type InitTelemetryOptions = {
  endpoint?: string;
  createSdk?: (endpoint: string) => TelemetrySdk;
  force?: boolean;
};

let activeSdk: TelemetrySdk | null = null;

function createSdk(endpoint: string): TelemetrySdk {
  return new NodeSDK({
    serviceName: "workstream-api",
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
}

export function initTelemetry(options: InitTelemetryOptions = {}): boolean {
  const endpoint = options.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return false;
  if (activeSdk && !options.force) return true;

  activeSdk = (options.createSdk ?? createSdk)(endpoint);
  activeSdk.start();
  return true;
}

export async function shutdownTelemetry(): Promise<void> {
  if (!activeSdk) return;
  const sdk = activeSdk;
  activeSdk = null;
  await sdk.shutdown();
}

export async function resetTelemetryForTests(): Promise<void> {
  await shutdownTelemetry();
}

export function setSpanAttributes(
  span: Span | undefined,
  attributes: Record<string, AttributeValue | null | undefined>,
): void {
  if (!span) return;

  for (const [key, value] of Object.entries(attributes)) {
    if (value != null) span.setAttribute(key, value);
  }
}

export async function withTelemetrySpan<T>(
  name: string,
  attributes: Record<string, AttributeValue | null | undefined>,
  operation: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer("workstream-api");
  return tracer.startActiveSpan(name, async (span) => {
    setSpanAttributes(span, attributes);
    try {
      const result = await operation();
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
  });
}

export function annotateActiveSpan(
  attributes: Record<string, AttributeValue | null | undefined>,
): void {
  setSpanAttributes(trace.getActiveSpan(), attributes);
}

export function annotateRouteSpan(request: FastifyRequest): void {
  if (!request.url.startsWith("/v1/")) return;

  const projectId =
    typeof request.params === "object" &&
    request.params != null &&
    "projectId" in request.params &&
    typeof request.params.projectId === "string"
      ? request.params.projectId
      : undefined;

  annotateActiveSpan({
    "operator.id": request.userId,
    "project.id": projectId,
    "http.route.scope": "v1",
  });
}
