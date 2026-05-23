import "server-only";

import { clerkEnabled } from "./auth";
import { operatorApiUrl } from "./public-env";

export function getApiUrl(): string {
  return operatorApiUrl();
}

export async function upstreamAuthHeaders(
  extra?: HeadersInit,
): Promise<Headers> {
  const headers = new Headers(extra);
  if (!clerkEnabled) return headers;
  const { auth } = await import("@clerk/nextjs/server");
  const { getToken } = await auth();
  const token = await getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}
