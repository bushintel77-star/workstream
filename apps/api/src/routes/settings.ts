import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth";
import { clearEnvSecret, setEnvSecret } from "../lib/runtime-secrets";
import { validateStripeKey } from "../lib/stripe";

const RatePatchSchema = z.object({
  rate: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

type IntegrationDef = {
  key: string;
  label: string;
  description: string;
  env: string;
  category: "ai" | "payments" | "geo" | "auth" | "accounting";
  placeholder: string;
};

const INTEGRATIONS: ReadonlyArray<IntegrationDef> = [
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic (Claude)",
    description:
      "Drives the design proposal and the second-pass audit. Without it the API falls back to canned outputs.",
    env: "ANTHROPIC_API_KEY",
    category: "ai",
    placeholder: "sk-ant-…",
  },
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI (Whisper)",
    description:
      "Transcribes site-walk recordings. Without it dictation uses a canned transcript.",
    env: "OPENAI_API_KEY",
    category: "ai",
    placeholder: "sk-…",
  },
  {
    key: "MAPBOX_TOKEN",
    label: "Mapbox",
    description:
      "Address geocoding for new projects. Without it surveys fall back to mock geometry.",
    env: "MAPBOX_TOKEN",
    category: "geo",
    placeholder: "pk.eyJ…",
  },
  {
    key: "STRIPE_SECRET_KEY",
    label: "Stripe (secret)",
    description:
      "Creates real deposit checkout sessions from the client portal. Without it the portal uses a dev-fallback link.",
    env: "STRIPE_SECRET_KEY",
    category: "payments",
    placeholder: "sk_live_… or sk_test_…",
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    label: "Stripe webhook secret",
    description: "Verifies Stripe webhook signatures for payment events.",
    env: "STRIPE_WEBHOOK_SECRET",
    category: "payments",
    placeholder: "whsec_…",
  },
  {
    key: "CLERK_SECRET_KEY",
    label: "Clerk (secret)",
    description:
      "Enables real user auth. Without it the API runs in dev-mode and accepts any caller as 'dev-user'.",
    env: "CLERK_SECRET_KEY",
    category: "auth",
    placeholder: "sk_live_… or sk_test_…",
  },
] as const;

const ALLOWED_KEYS = new Set(INTEGRATIONS.map((i) => i.key));

const SetIntegrationSchema = z.object({
  value: z.string().min(1).max(2048),
});

function maskValue(raw: string): { last4: string; length: number } {
  const trimmed = raw.trim();
  const last4 = trimmed.length >= 4 ? trimmed.slice(-4) : trimmed;
  return { last4, length: trimmed.length };
}

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/rate-card",
    { preHandler: requireAuth },
    async (request, reply) => {
      const items = await fastify.store.listRateCard(request.userId!);
      return reply.send({ items, count: items.length });
    }
  );

  fastify.patch(
    "/rate-card/:sku",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { sku } = request.params as { sku: string };
      const parsed = RatePatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const item = await fastify.store.updateRateCardItem(
        request.userId!,
        sku,
        parsed.data,
      );
      if (!item) return reply.code(404).send({ error: "SKU not found" });
      return reply.send({ item });
    },
  );

  fastify.get(
    "/plant-palette",
    { preHandler: requireAuth },
    async (request, reply) => {
      const items = await fastify.store.listPlantPalette(request.userId!);
      return reply.send({ items, count: items.length });
    }
  );

  fastify.get(
    "/integrations",
    { preHandler: requireAuth },
    async (request, reply) => {
      const stored = await fastify.store.listIntegrations(request.userId!);
      const byKey = new Map(stored.map((s) => [s.key, s]));
      const items = INTEGRATIONS.map((def) => {
        const storeRow = byKey.get(def.key);
        const envValue = process.env[def.env];
        const source: "store" | "env" | "none" = storeRow
          ? "store"
          : envValue
            ? "env"
            : "none";
        const effective = storeRow?.value ?? envValue ?? null;
        const mask = effective ? maskValue(effective) : null;
        return {
          key: def.key,
          label: def.label,
          description: def.description,
          category: def.category,
          placeholder: def.placeholder,
          configured: source !== "none",
          source,
          last4: mask?.last4 ?? null,
          length: mask?.length ?? null,
          updated_at: storeRow?.updated_at ?? null,
        };
      });
      return reply.send({ items });
    },
  );

  fastify.put(
    "/integrations/:key",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      if (!ALLOWED_KEYS.has(key)) {
        return reply.code(404).send({ error: "Unknown integration key" });
      }
      const parsed = SetIntegrationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const trimmed = parsed.data.value.trim();
      if (trimmed.length === 0) {
        return reply.code(400).send({ error: "Value cannot be blank" });
      }
      if (key === "STRIPE_SECRET_KEY") {
        const check = await validateStripeKey(trimmed);
        if (!check.ok) {
          return reply.code(400).send({
            error: "Stripe rejected this key",
            detail: check.message,
          });
        }
      }
      const row = await fastify.store.setIntegration(
        request.userId!,
        key,
        trimmed,
      );
      setEnvSecret(key, trimmed);
      const mask = maskValue(row.value);
      return reply.send({
        item: {
          key: row.key,
          configured: true,
          source: "store" as const,
          last4: mask.last4,
          length: mask.length,
          updated_at: row.updated_at,
        },
      });
    },
  );

  fastify.delete(
    "/integrations/:key",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      if (!ALLOWED_KEYS.has(key)) {
        return reply.code(404).send({ error: "Unknown integration key" });
      }
      await fastify.store.deleteIntegration(request.userId!, key);
      clearEnvSecret(key);
      return reply.code(204).send();
    },
  );
}
