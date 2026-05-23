import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  IntegrationChannelSchema,
  IntegrationNotifyInputSchema,
  WorkspacePlanSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import {
  channelStatuses,
  dispatchQuoteGenerated,
  getIntegrationSummary,
} from "../lib/integration-dispatch";
import {
  createStudioCheckout,
  studioPriceConfigured,
} from "../lib/stripe-studio";
import { crmPayloadFromProject, postCrmWebhook } from "../lib/crm-webhook";
import { sendQuotePackEmail } from "../lib/email-resend";
import { hydrateEnvForOwner, resolveSecret } from "../lib/integration-secrets";
import { validateStripeKey } from "../lib/stripe";
import { signPortalToken, buildPortalUrl } from "../lib/magic-link";

const TestBodySchema = z.object({
  channel: IntegrationChannelSchema,
  to_email: z.string().email().optional(),
});

const CheckoutBodySchema = z.object({
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

export default async function integrationHubRoutes(fastify: FastifyInstance) {
  fastify.get("/summary", { preHandler: requireAuth }, async (request, reply) => {
    const ownerId = request.userId!;
    await hydrateEnvForOwner(fastify.store, ownerId);
    const summary = await getIntegrationSummary(fastify.store, ownerId);
    return reply.send({ summary });
  });

  fastify.get("/hub", { preHandler: requireAuth }, async (request, reply) => {
    const ownerId = request.userId!;
    await hydrateEnvForOwner(fastify.store, ownerId);
    const billing = await fastify.store.getWorkspaceBilling(ownerId);
    const channels = await channelStatuses(fastify.store, ownerId);
    const events = await fastify.store.listIntegrationEvents(ownerId, 30);
    const summary = await getIntegrationSummary(fastify.store, ownerId);
    return reply.send({ billing, channels, events, summary });
  });

  fastify.post(
    "/plan/checkout",
    { preHandler: requireAuth },
    async (request, reply) => {
      const ownerId = request.userId!;
      const parsed = CheckoutBodySchema.safeParse(request.body ?? {});
      const webBase =
        process.env.WEB_BASE_URL ?? "http://localhost:3002";
      const successUrl =
        parsed.success && parsed.data.success_url
          ? parsed.data.success_url
          : `${webBase}/settings?studio=success`;
      const cancelUrl =
        parsed.success && parsed.data.cancel_url
          ? parsed.data.cancel_url
          : `${webBase}/settings?studio=cancel`;
      const checkout = await createStudioCheckout(
        fastify.store,
        ownerId,
        successUrl,
        cancelUrl,
      );
      await hydrateEnvForOwner(fastify.store, ownerId);
      return reply.send({
        ...checkout,
        studio_price_configured: studioPriceConfigured(),
      });
    },
  );

  fastify.post("/hub/test", { preHandler: requireAuth }, async (request, reply) => {
    const ownerId = request.userId!;
    const parsed = TestBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    await hydrateEnvForOwner(fastify.store, ownerId);
    const billing = await fastify.store.getWorkspaceBilling(ownerId);
    const { channel, to_email } = parsed.data;

    if (channel === "crm") {
      const project = (await fastify.store.listProjects(ownerId))[0];
      if (!project) {
        return reply.code(409).send({ error: "Create a project first to test CRM" });
      }
      const result = await postCrmWebhook(
        fastify.store,
        ownerId,
        crmPayloadFromProject(project, "manual.sync", {
          client_name: "Integration test",
        }),
      );
      await fastify.store.appendIntegrationEvent(ownerId, {
        project_id: project.id,
        event: "manual.sync",
        channel: "crm",
        ok: result.ok,
        detail: result.detail,
      });
      return reply.send({ channel, ...result, plan: billing.plan });
    }

    if (channel === "email") {
      if (!to_email) {
        return reply.code(400).send({ error: "to_email required for email test" });
      }
      const result = await sendQuotePackEmail(fastify.store, ownerId, {
        to: to_email,
        projectAddress: "Integration test — 1 Test St, Melbourne VIC",
        clientName: "Test client",
        quoteUrl: "https://workstream-web.fly.dev",
      });
      await fastify.store.appendIntegrationEvent(ownerId, {
        project_id: null,
        event: "manual.sync",
        channel: "email",
        ok: result.ok,
        detail: result.detail,
      });
      return reply.send({ channel, ...result, plan: billing.plan });
    }

    if (channel === "stripe") {
      const key = await resolveSecret(fastify.store, ownerId, "STRIPE_SECRET_KEY");
      if (!key) {
        return reply.send({
          channel,
          ok: false,
          detail: "STRIPE_SECRET_KEY not set",
          live: false,
        });
      }
      const check = await validateStripeKey(key);
      return reply.send({
        channel,
        ok: check.ok,
        detail: check.ok ? `Stripe OK (livemode=${check.livemode})` : check.message,
        live: check.ok && billing.plan === "studio",
      });
    }

    const configured = await channelStatuses(fastify.store, ownerId);
    const row = configured.find((c) => c.channel === channel);
    return reply.send({
      channel,
      ok: row?.live ?? false,
      detail: row
        ? `${row.label}: ${row.configured ? "configured" : "not set"} · ${row.live ? "live" : "fallback"}`
        : "Unknown channel",
      plan: billing.plan,
    });
  });

  fastify.post(
    "/plan/upgrade",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = WorkspacePlanSchema.safeParse(
        (request.body as { plan?: string })?.plan ?? "studio",
      );
      if (!parsed.success) {
        return reply.code(400).send({ error: "plan must be lite or studio" });
      }
      if (parsed.data === "studio") {
        const devBypass =
          process.env.AUTH_REQUIRED === "false" ||
          process.env.NODE_ENV !== "production";
        if (!devBypass) {
          return reply.code(402).send({
            error: "Studio requires Stripe checkout",
            hint: "POST /integrations/plan/checkout with success_url and cancel_url",
          });
        }
      }
      const billing = await fastify.store.setWorkspacePlan(
        request.userId!,
        parsed.data,
      );
      await hydrateEnvForOwner(fastify.store, request.userId!);
      return reply.send({
        billing,
        note:
          parsed.data === "studio"
            ? "Studio unlocked live integrations (Stripe billing TBD)."
            : "Lite — dev fallbacks for live connectors.",
      });
    },
  );
}

export async function registerProjectIntegrationRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.post(
    "/:projectId/integrations/sync",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const parsed = IntegrationNotifyInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Invalid body", issues: parsed.error.issues });
      }

      const project = await fastify.store.getProject(ownerId, projectId);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const outputs = await fastify.store.listOutputs(ownerId, projectId);
      const quote = outputs.find((o) => o.kind === "quote");
      if (!quote?.uri) {
        return reply.code(409).send({
          error: "Generate a quote output before syncing to CRM/email",
        });
      }

      let portalUrl: string | undefined;
      if (parsed.data.include_portal) {
        const token = signPortalToken({
          project_id: projectId,
          scope: "quote_view",
        });
        portalUrl = buildPortalUrl("quote_view", token);
      }

      await hydrateEnvForOwner(fastify.store, ownerId);
      const clientName =
        parsed.data.client_name ?? project.client_name ?? undefined;
      const clientEmail =
        parsed.data.to_email ?? project.client_email ?? undefined;
      if (clientName || clientEmail) {
        await fastify.store.updateProjectClient(ownerId, projectId, {
          client_name: clientName ?? project.client_name ?? null,
          client_email: clientEmail ?? project.client_email ?? null,
          crm_stage: "quote_sent",
        });
      }

      const result = await dispatchQuoteGenerated(
        fastify.store,
        ownerId,
        project,
        {
          quote_url: quote.uri,
          portal_url: portalUrl,
          to_email: clientEmail,
          client_name: clientName,
        },
      );

      if (result.crm) {
        await fastify.store.touchProjectCrmSync(ownerId, projectId);
      }

      return reply.send({
        ok: result.crm || result.email,
        crm: result.crm,
        email: result.email,
        quote_url: quote.uri,
        portal_url: portalUrl ?? null,
      });
    },
  );
}
