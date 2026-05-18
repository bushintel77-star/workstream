import type { FastifyRequest } from "fastify";

/**
 * Resolve a base URL we can safely embed in stored URIs. Prefer the explicit
 * PUBLIC_API_URL env, otherwise derive from the incoming Host header. In
 * production we refuse to fall back to localhost — that would persist broken
 * URLs into the store. In development we tolerate a missing host since a
 * single-machine setup may not always set one.
 */
export function publicBaseUrl(request: FastifyRequest): string {
  const fromEnv = process.env.PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const host = request.headers.host;
  const protocol = request.protocol;
  if (host) return `${protocol}://${host}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Cannot derive public base URL: set PUBLIC_API_URL or ensure upstream forwards Host header.",
    );
  }

  return "http://localhost:3001";
}
