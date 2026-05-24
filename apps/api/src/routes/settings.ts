import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth";
import { clearEnvSecret, setEnvSecret } from "../lib/runtime-secrets";
import { validateStripeKey } from "../lib/stripe";
import {
  ALLOWED_INTEGRATION_KEYS,
  INTEGRATION_REGISTRY,
} from "../lib/integration-registry";
import { canUseLiveIntegration } from "@workstream/domain";

const RatePatchSchema = z.object({
  rate: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

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
    },
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
    },
  );

  fastify.get(
    "/integrations",
    { preHandler: requireAuth },
    async (request, reply) => {
      const ownerId = request.userId!;
      const billing = await fastify.store.getWorkspaceBilling(ownerId);
      const stored = await fastify.store.listIntegrations(ownerId);
      const byKey = new Map(stored.map((s) => [s.key, s]));
      const items = INTEGRATION_REGISTRY.map((def) => {
        const storeRow = byKey.get(def.key);
        const envValue = process.env[def.env];
        const source: "store" | "env" | "none" = storeRow
          ? "store"
          : envValue
            ? "env"
            : "none";
        const effective = storeRow?.value ?? envValue ?? null;
        const mask = effective ? maskValue(effective) : null;
        const live =
          source !== "none" && canUseLiveIntegration(billing.plan, def.key);
        return {
          key: def.key,
          label: def.label,
          description: def.description,
          category: def.category,
          placeholder: def.placeholder,
          channel: def.channel,
          configured: source !== "none",
          live,
          source,
          last4: mask?.last4 ?? null,
          length: mask?.length ?? null,
          updated_at: storeRow?.updated_at ?? null,
        };
      });
      return reply.send({ items, billing });
    },
  );

  fastify.put(
    "/integrations/:key",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      if (!ALLOWED_INTEGRATION_KEYS.has(key)) {
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
      const billing = await fastify.store.getWorkspaceBilling(request.userId!);
      setEnvSecret(key, trimmed);
      const mask = maskValue(row.value);
      const live = canUseLiveIntegration(billing.plan, key);
      return reply.send({
        item: {
          key: row.key,
          configured: true,
          live,
          source: "store" as const,
          last4: mask.last4,
          length: mask.length,
          updated_at: row.updated_at,
        },
        billing,
        note: live
          ? null
          : "Saved — goes live on Studio plan (Lite keeps dev fallbacks).",
      });
    },
  );

  fastify.delete(
    "/integrations/:key",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      if (!ALLOWED_INTEGRATION_KEYS.has(key)) {
        return reply.code(404).send({ error: "Unknown integration key" });
      }
      await fastify.store.deleteIntegration(request.userId!, key);
      clearEnvSecret(key);
      return reply.code(204).send();
    },
  );

  fastify.get(
    "/activity",
    { preHandler: requireAuth },
    async (request, reply) => {
      const events = await fastify.store.listWorkspaceActivityEvents(
        request.userId!,
      );
      return reply.send({ events });
    },
  );
}
