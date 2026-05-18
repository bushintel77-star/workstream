import { FastifyInstance } from "fastify";
import {
  LinkCustomerInputSchema,
  UpsertSkuLinkInputSchema,
} from "@construct/contracts";
import { requireAuth } from "../plugins/auth";
import {
  draftInvoiceFromCosting,
  isMyobLive,
  listCustomers,
  listItems,
} from "../lib/myob";

export default async function myobRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/status",
    { preHandler: requireAuth },
    async (request, _reply) => {
      const ownerId = request.userId!;
      const [customers, items, skuLinks] = await Promise.all([
        listCustomers().catch(() => []),
        listItems().catch(() => []),
        fastify.store.listSkuLinks(ownerId),
      ]);
      const linkedSkus = new Set(skuLinks.map((l) => l.construct_sku));
      const rateCard = await fastify.store.listRateCard(ownerId);
      const matchPct =
        rateCard.length === 0
          ? 0
          : Math.round(
              (rateCard.filter((r) => linkedSkus.has(r.sku)).length /
                rateCard.length) *
                100,
            );
      const lastSync = skuLinks.reduce<string | null>((latest, l) => {
        if (!latest) return l.last_synced_at;
        return l.last_synced_at > latest ? l.last_synced_at : latest;
      }, null);
      return {
        connected: isMyobLive(),
        mode: isMyobLive() ? "live" : "dev_fallback",
        company_file_id: process.env.MYOB_COMPANY_FILE_ID ?? null,
        customers_cached: customers.length,
        items_cached: items.length,
        sku_match_pct: matchPct,
        last_sync_at: lastSync,
      };
    },
  );

  fastify.get(
    "/customers",
    { preHandler: requireAuth },
    async (_request, reply) => {
      try {
        const customers = await listCustomers();
        return reply.send({ customers });
      } catch (err) {
        _request.log.warn(err, "MYOB customer fetch failed");
        return reply.code(502).send({ error: "Upstream MYOB failed" });
      }
    },
  );

  fastify.get(
    "/items",
    { preHandler: requireAuth },
    async (_request, reply) => {
      try {
        const items = await listItems();
        return reply.send({ items });
      } catch (err) {
        _request.log.warn(err, "MYOB item fetch failed");
        return reply.code(502).send({ error: "Upstream MYOB failed" });
      }
    },
  );

  fastify.get(
    "/sku-links",
    { preHandler: requireAuth },
    async (request, reply) => {
      const links = await fastify.store.listSkuLinks(request.userId!);
      return reply.send({ links });
    },
  );

  fastify.put(
    "/sku-links",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = UpsertSkuLinkInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const link = await fastify.store.upsertSkuLink(
        request.userId!,
        parsed.data,
      );
      return reply.send({ link });
    },
  );

  fastify.delete(
    "/sku-links/:sku",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { sku } = request.params as { sku: string };
      const ok = await fastify.store.removeSkuLink(
        request.userId!,
        decodeURIComponent(sku),
      );
      if (!ok) return reply.code(404).send({ error: "Link not found" });
      return reply.code(204).send();
    },
  );

  fastify.post(
    "/projects/:projectId/customer",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const parsed = LinkCustomerInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const link = await fastify.store.upsertProjectMyobLink(
          request.userId!,
          projectId,
          { myob_customer_uid: parsed.data.myob_customer_uid },
        );
        return reply.code(201).send({ link });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Link failed";
        if (message.startsWith("Project not found")) {
          return reply.code(404).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.post(
    "/projects/:projectId/invoice",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;

      const project = await fastify.store.getProject(ownerId, projectId);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const link = await fastify.store.getProjectMyobLink(ownerId, projectId);
      if (!link) {
        return reply.code(409).send({
          error: "Project not linked to a MYOB customer. Link first.",
        });
      }

      const costings = await fastify.store.listCostings(ownerId, projectId);
      const standard =
        costings.find((c) => c.scenario === "standard") ?? costings[0];
      if (!standard) {
        return reply
          .code(409)
          .send({ error: "Costing is required before invoicing." });
      }

      try {
        const result = await draftInvoiceFromCosting({
          project,
          customerUid: link.myob_customer_uid,
          costing: standard,
        });
        await fastify.store.upsertProjectMyobLink(ownerId, projectId, {
          invoice_uid: result.invoice_uid,
        });
        return reply.code(201).send({
          invoice: result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invoice failed";
        request.log.error(err);
        return reply.code(502).send({ error: message });
      }
    },
  );
}
