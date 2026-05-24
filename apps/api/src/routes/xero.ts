import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import {
  draftInvoiceFromCosting,
  isXeroLive,
  listContacts,
  listItems,
} from "../lib/xero";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

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
        tenant_id: process.env.XERO_TENANT_ID ?? null,
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
      const { contact_id } = (request.body ?? {}) as { contact_id?: string };
      if (!contact_id) {
        return reply.code(400).send({ error: "contact_id required" });
      }

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
        const message = err instanceof Error ? err.message : "Invoice failed";
        request.log.error(err);
        return reply.code(502).send({ error: message });
      }
    },
  );
}
