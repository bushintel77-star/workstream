import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth";
import {
  draftInvoiceFromCosting,
  isXeroLive,
  listContacts,
  listItems,
} from "../lib/xero";
import { getOwnerEnv } from "../lib/owner-secrets";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

const XeroInvoiceBodySchema = z.object({
  contact_id: z.string().min(1),
});

export default async function xeroRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/status",
    { preHandler: requireAuth },
    async (_request, reply) => {
      const [contacts, items] = await Promise.all([
        listContacts().catch(() => []),
        listItems().catch(() => []),
      ]);
      return reply.send({
        connected: isXeroLive(),
        mode: isXeroLive() ? "live" : "dev_fallback",
        tenant_id: getOwnerEnv("XERO_TENANT_ID") ?? null,
        contacts_cached: contacts.length,
        items_cached: items.length,
        last_sync_at: null,
      });
    },
  );

  fastify.get(
    "/contacts",
    { preHandler: requireAuth },
    async (_request, reply) => {
      try {
        const contacts = await listContacts();
        return reply.send({ contacts });
      } catch (err) {
        _request.log.warn(err, "Xero contacts fetch failed");
        return reply.code(502).send({ error: "Upstream Xero failed" });
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
        _request.log.warn(err, "Xero items fetch failed");
        return reply.code(502).send({ error: "Upstream Xero failed" });
      }
    },
  );

  fastify.post(
    "/projects/:projectId/invoice",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const parsed = XeroInvoiceBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Validation failed",
          issues: parsed.error.issues,
        });
      }
      const { contact_id } = parsed.data;

      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
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
        const invoice = await draftInvoiceFromCosting({
          project,
          contactId: contact_id,
          costing: standard,
        });
        return reply.code(201).send({ invoice });
      } catch (err) {
        request.log.error({ err }, "Invoice failed");
        return reply.code(502).send({ error: "Invoice failed" });
      }
    },
  );
}
