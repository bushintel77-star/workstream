import type {
  IntegrationChannel,
  IntegrationEventType,
} from "@workstream/contracts";
import type { Project } from "@workstream/contracts";
import type { Store } from "@workstream/db";
import { canUseLiveIntegration } from "@workstream/domain";
import { crmPayloadFromProject, postCrmWebhook } from "./crm-webhook";
import { sendQuotePackEmail } from "./email-resend";
import { buildIntegrationSetupSteps } from "@workstream/domain";
import type { IntegrationSummary } from "@workstream/contracts";
import { isStripeLive } from "./stripe";
import { isMyobLive } from "./myob";
import { isXeroLive } from "./xero";

export type DispatchContext = {
  quote_url?: string;
  portal_url?: string;
  to_email?: string;
  client_name?: string;
};

async function logEvent(
  store: Store,
  ownerId: string,
  projectId: string | null,
  event: IntegrationEventType,
  channel: IntegrationChannel,
  ok: boolean,
  detail: string,
): Promise<void> {
  await store.appendIntegrationEvent(ownerId, {
    project_id: projectId,
    event,
    channel,
    ok,
    detail,
  });
}

export async function dispatchProjectCreated(
  store: Store,
  ownerId: string,
  project: Project,
): Promise<void> {
  const billing = await store.getWorkspaceBilling(ownerId);
  if (!canUseLiveIntegration(billing.plan, "CRM_WEBHOOK_URL")) {
    await logEvent(
      store,
      ownerId,
      project.id,
      "project.created",
      "crm",
      false,
      "Studio plan required for live CRM sync (Lite: configure webhook for later)",
    );
    return;
  }

  const crm = await postCrmWebhook(
    store,
    ownerId,
    crmPayloadFromProject(project, "project.created"),
  );
  await logEvent(
    store,
    ownerId,
    project.id,
    "project.created",
    "crm",
    crm.ok,
    crm.detail,
  );
}

export async function dispatchQuoteGenerated(
  store: Store,
  ownerId: string,
  project: Project,
  ctx: DispatchContext,
): Promise<{ crm: boolean; email: boolean }> {
  const billing = await store.getWorkspaceBilling(ownerId);
  const event: IntegrationEventType = "quote.generated";
  let crmOk = false;
  let emailOk = false;

  if (canUseLiveIntegration(billing.plan, "CRM_WEBHOOK_URL")) {
    const crm = await postCrmWebhook(
      store,
      ownerId,
      crmPayloadFromProject(project, event, {
        quote_url: ctx.quote_url,
        portal_url: ctx.portal_url,
        client_name: ctx.client_name,
      }),
    );
    crmOk = crm.ok;
    await logEvent(store, ownerId, project.id, event, "crm", crm.ok, crm.detail);
  } else {
    await logEvent(
      store,
      ownerId,
      project.id,
      event,
      "crm",
      false,
      "CRM sync skipped — upgrade to Studio or use dev CRM webhook test",
    );
  }

  if (ctx.to_email && ctx.quote_url) {
    if (canUseLiveIntegration(billing.plan, "RESEND_API_KEY")) {
      const mail = await sendQuotePackEmail(store, ownerId, {
        to: ctx.to_email,
        projectAddress: project.address,
        clientName: ctx.client_name,
        quoteUrl: ctx.quote_url,
        portalUrl: ctx.portal_url,
      });
      emailOk = mail.ok;
      await logEvent(
        store,
        ownerId,
        project.id,
        event,
        "email",
        mail.ok,
        mail.detail,
      );
    } else {
      await logEvent(
        store,
        ownerId,
        project.id,
        event,
        "email",
        false,
        "Email skipped — Studio plan + RESEND_API_KEY required",
      );
    }
  }

  return { crm: crmOk, email: emailOk };
}

export type ChannelStatus = {
  channel: IntegrationChannel;
  label: string;
  live: boolean;
  configured: boolean;
  note: string;
};

export async function channelStatuses(
  store: Store,
  ownerId: string,
): Promise<ChannelStatus[]> {
  const billing = await store.getWorkspaceBilling(ownerId);
  const plan = billing.plan;
  const integs = await store.listIntegrations(ownerId);
  const has = (key: string) =>
    integs.some((i) => i.key === key) || !!process.env[key];

  const studio = (key: string) =>
    canUseLiveIntegration(plan, key) && has(key);

  const rows = [
    {
      channel: "anthropic",
      label: "Anthropic",
      configured: has("ANTHROPIC_API_KEY"),
      live: studio("ANTHROPIC_API_KEY"),
      note: plan === "lite" ? "Dev fallback on Lite" : "",
    },
    {
      channel: "openai",
      label: "OpenAI",
      configured: has("OPENAI_API_KEY"),
      live: studio("OPENAI_API_KEY"),
      note: plan === "lite" ? "Dev fallback on Lite" : "",
    },
    {
      channel: "mapbox",
      label: "Mapbox",
      configured: has("MAPBOX_TOKEN"),
      live: studio("MAPBOX_TOKEN"),
      note: "",
    },
    {
      channel: "stripe",
      label: "Stripe",
      configured: has("STRIPE_SECRET_KEY"),
      live: plan === "studio" && isStripeLive(),
      note: "",
    },
    {
      channel: "myob",
      label: "MYOB",
      configured: has("MYOB_ACCESS_TOKEN") && has("MYOB_COMPANY_FILE_ID"),
      live: plan === "studio" && isMyobLive(),
      note: "",
    },
    {
      channel: "xero",
      label: "Xero",
      configured: has("XERO_ACCESS_TOKEN") && has("XERO_TENANT_ID"),
      live: plan === "studio" && isXeroLive(),
      note: "",
    },
    {
      channel: "crm",
      label: "CRM webhook",
      configured: has("CRM_WEBHOOK_URL"),
      live: studio("CRM_WEBHOOK_URL"),
      note: "Works with any free CRM that accepts POST JSON",
    },
    {
      channel: "email",
      label: "Resend email",
      configured: has("RESEND_API_KEY"),
      live: studio("RESEND_API_KEY"),
      note: "",
    },
  ] satisfies ChannelStatus[];
  return rows;
}

export async function getIntegrationSummary(
  store: Store,
  ownerId: string,
): Promise<IntegrationSummary> {
  const billing = await store.getWorkspaceBilling(ownerId);
  const channels = await channelStatuses(store, ownerId);
  const live_channels = channels.filter((c) => c.live).length;
  const next_steps = buildIntegrationSetupSteps(billing.plan, channels);
  const needs_attention = next_steps.some((s) => !s.done);
  return {
    plan: billing.plan,
    seat_limit: billing.seat_limit,
    live_channels,
    total_channels: channels.length,
    needs_attention,
    next_steps,
  };
}
