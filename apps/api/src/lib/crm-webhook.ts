import type { Project } from "@workstream/contracts";
import type { Store } from "@workstream/db";
import { resolveSecret } from "./integration-secrets";

export type CrmPayload = {
  source: "workstream";
  event: string;
  project_id: string;
  address: string;
  status: string;
  client_name?: string;
  quote_url?: string;
  portal_url?: string;
  created_at: string;
};

export async function postCrmWebhook(
  store: Store,
  ownerId: string,
  payload: CrmPayload,
): Promise<{ ok: boolean; detail: string }> {
  const url = await resolveSecret(store, ownerId, "CRM_WEBHOOK_URL");
  if (!url?.startsWith("http")) {
    return {
      ok: false,
      detail: "CRM webhook not configured — set CRM_WEBHOOK_URL in Integrations",
    };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Workstream-CRM/1.0",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    return { ok: false, detail: message };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, detail: `CRM returned ${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true, detail: "CRM webhook accepted" };
}

export function crmPayloadFromProject(
  project: Project,
  event: string,
  extra?: Partial<CrmPayload>,
): CrmPayload {
  return {
    source: "workstream",
    event,
    project_id: project.id,
    address: project.address,
    status: project.status,
    created_at: project.created_at,
    ...extra,
  };
}
