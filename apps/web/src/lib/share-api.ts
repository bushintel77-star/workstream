import type {
  PublicSharePayload,
  ShareDecisionInput,
} from "@workstream/contracts";
import { operatorApiUrl } from "./public-env";

const API_URL = operatorApiUrl();

export async function fetchPublicShare(
  token: string,
): Promise<PublicSharePayload | { error: "not_found" }> {
  const res = await fetch(`${API_URL}/share/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!res.ok) return { error: "not_found" };
  return res.json() as Promise<PublicSharePayload>;
}

export async function submitShareDecision(
  token: string,
  body: ShareDecisionInput,
): Promise<
  | { ok: true; payload: PublicSharePayload }
  | {
      ok: false;
      status: number;
      error: string;
    }
> {
  const res = await fetch(
    `${API_URL}/share/${encodeURIComponent(token)}/decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      status: res.status,
      error: data.error ?? "Could not save decision",
    };
  }
  const data = (await res.json()) as {
    ok: true;
    payload: PublicSharePayload;
  };
  return data;
}
