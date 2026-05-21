import type { Store } from "@workstream/db";
import { resolveSecret } from "./integration-secrets";

const RESEND_API = "https://api.resend.com/emails";

export type QuotePackEmailArgs = {
  to: string;
  projectAddress: string;
  clientName?: string;
  quoteUrl: string;
  portalUrl?: string;
};

export async function sendQuotePackEmail(
  store: Store,
  ownerId: string,
  args: QuotePackEmailArgs,
): Promise<{ ok: boolean; detail: string }> {
  const apiKey = await resolveSecret(store, ownerId, "RESEND_API_KEY");
  const from =
    (await resolveSecret(store, ownerId, "EMAIL_FROM")) ??
    "Workstream <onboarding@resend.dev>";

  if (!apiKey) {
    return {
      ok: false,
      detail: "Resend not configured — set RESEND_API_KEY and EMAIL_FROM",
    };
  }

  const greeting = args.clientName
    ? `Hi ${args.clientName},`
    : "Hi,";
  const portalBlock = args.portalUrl
    ? `\n\nView your quote and pay a deposit: ${args.portalUrl}`
    : "";

  const text = `${greeting}

Your landscape quote for ${args.projectAddress} is ready.

Open the quote: ${args.quoteUrl}${portalBlock}

— Curtis & Co via Workstream`;

  let res: Response;
  try {
    res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: `Quote — ${args.projectAddress}`,
        text,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    return { ok: false, detail: message };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, detail: `Resend ${res.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true, detail: `Email sent to ${args.to}` };
}

export async function isEmailLive(
  store: Store,
  ownerId: string,
): Promise<boolean> {
  const key = await resolveSecret(store, ownerId, "RESEND_API_KEY");
  return !!key;
}
