import { FastifyInstance } from "fastify";
import { verifyStripeWebhook, type StripeEvent } from "../lib/stripe";
import { applyStudioFromCheckoutSession } from "../lib/stripe-studio";

/**
 * Stripe webhook receiver. Mounted at /webhooks/stripe with a custom raw-body
 * parser so signature verification can hash the bytes Stripe sent, not the
 * JSON-decoded object.
 *
 * Handled events:
 *   checkout.session.completed  → mark project deposit as paid
 *   payment_intent.succeeded    → log only (Checkout covers it)
 *   payment_intent.payment_failed → log only
 *
 * The handler is idempotent — same event.id arriving twice is a no-op.
 */
export default async function stripeWebhookRoutes(fastify: FastifyInstance) {
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      if (req.url === "/webhooks/stripe") {
        // Preserve raw text so signature verification can hash it.
        (req as unknown as { rawBody: string }).rawBody = body as string;
      }
      try {
        const json = body ? JSON.parse(body as string) : {};
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  const seenEvents = new Set<string>();

  fastify.post("/webhooks/stripe", async (request, reply) => {
    const rawBody =
      (request as unknown as { rawBody: string }).rawBody ??
      JSON.stringify(request.body ?? {});
    const sig = request.headers["stripe-signature"];
    const sigStr = Array.isArray(sig) ? sig[0] : sig;

    const verify = verifyStripeWebhook(rawBody, sigStr);
    if (!verify.ok) {
      request.log.warn({ reason: verify.reason }, "stripe webhook rejected");
      return reply.code(400).send({ error: verify.reason });
    }

    const event = request.body as StripeEvent;
    if (seenEvents.has(event.id)) {
      return reply.send({ received: true, duplicate: true });
    }
    seenEvents.add(event.id);
    // Cap the dedup set so it doesn't grow unbounded
    if (seenEvents.size > 1000) {
      const first = seenEvents.values().next().value;
      if (first) seenEvents.delete(first);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          id: string;
          metadata?: {
            project_id?: string;
            deposit_pct?: string;
            owner_id?: string;
            purpose?: string;
          };
          payment_status?: string;
          customer?: string;
          subscription?: string;
        };

        if (session.metadata?.purpose === "studio_upgrade") {
          const upgraded = await applyStudioFromCheckoutSession(
            fastify.store,
            session,
          );
          if (upgraded) {
            request.log.info(
              { ownerId: session.metadata?.owner_id, sessionId: session.id },
              "studio plan activated via Stripe",
            );
          }
          break;
        }

        const projectId = session.metadata?.project_id;
        if (!projectId) {
          request.log.warn(
            { sessionId: session.id },
            "stripe session has no project_id metadata",
          );
          break;
        }
        // Cross-tenant lookup — owner not in the webhook payload.
        const owners = ["dev-user"];
        let advanced = false;
        for (const ownerId of owners) {
          const project = await fastify.store.getProject(ownerId, projectId);
          if (project) {
            await fastify.store.updateProjectStatus(
              ownerId,
              projectId,
              "complete",
            );
            advanced = true;
            break;
          }
        }
        if (advanced) {
          request.log.info(
            { projectId, sessionId: session.id, event: event.type },
            "deposit paid, project marked complete",
          );
        } else {
          request.log.warn(
            { projectId, sessionId: session.id },
            "stripe webhook for unknown project",
          );
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as {
          metadata?: { owner_id?: string };
        };
        const ownerId = sub.metadata?.owner_id;
        if (ownerId) {
          await fastify.store.patchWorkspaceBilling(ownerId, {
            plan: "lite",
            stripe_subscription_id: null,
          });
          request.log.info({ ownerId }, "studio subscription ended — lite plan");
        }
        break;
      }
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
        request.log.info(
          { eventType: event.type, eventId: event.id },
          "stripe payment event",
        );
        break;
      default:
        request.log.debug(
          { eventType: event.type },
          "unhandled stripe event",
        );
    }

    return reply.send({ received: true });
  });
}
