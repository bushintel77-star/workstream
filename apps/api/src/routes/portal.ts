import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { signPortalToken, verifyPortalToken } from "../lib/magic-link";
import { createDepositSession } from "../lib/stripe";

export default async function portalRoutes(fastify: FastifyInstance) {
  // --- Authed: studio side ---
  fastify.post(
    "/projects/:projectId/magic-link",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { scope } = (request.body ?? {}) as { scope?: string };
      const project = await fastify.store.getProject(
        request.userId!,
        projectId,
      );
      if (!project) return reply.code(404).send({ error: "Project not found" });
      const validScope =
        scope === "quote_view" ||
        scope === "deposit_checkout" ||
        scope === "change_request"
          ? scope
          : "quote_view";
      const token = signPortalToken({
        project_id: projectId,
        scope: validScope,
      });
      const portalUrl =
        (process.env.PORTAL_BASE_URL ?? "https://construct.example/portal") +
        `/${validScope}/${token}`;
      return reply.send({ token, portal_url: portalUrl, scope: validScope });
    },
  );

  // --- Public: client side (token-gated, NO requireAuth) ---
  // Stricter rate-limit here — these are the only endpoints reachable
  // without auth and would otherwise be the primary brute-force target.
  fastify.get("/portal/quote/:token", {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute",
      },
    },
  }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const verify = verifyPortalToken(token);
    if (!verify.ok) return reply.code(401).send({ error: verify.reason });
    if (verify.payload.scope !== "quote_view") {
      return reply.code(403).send({ error: "Token scope does not allow quote view" });
    }
    const projectId = verify.payload.project_id;
    // The portal serves what the client should see — owner_id is whoever owns
    // the project, looked up via the cross-tenant store accessor.
    const owners = await listAllOwnersForProject(fastify, projectId);
    const ownerId = owners[0];
    if (!ownerId) return reply.code(404).send({ error: "Project not found" });

    const project = await fastify.store.getProject(ownerId, projectId);
    const survey = await fastify.store.getSurvey(ownerId, projectId);
    const design = await fastify.store.getDesign(ownerId, projectId);
    const costings = await fastify.store.listCostings(ownerId, projectId);
    const standard =
      costings.find((c) => c.scenario === "standard") ?? costings[0];

    return reply.send({ project, survey, design, costing: standard });
  });

  fastify.post("/portal/deposit/:token", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
      },
    },
  }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const verify = verifyPortalToken(token);
    if (!verify.ok) return reply.code(401).send({ error: verify.reason });
    if (verify.payload.scope !== "deposit_checkout") {
      return reply.code(403).send({ error: "Token scope does not allow deposit" });
    }
    const projectId = verify.payload.project_id;
    const owners = await listAllOwnersForProject(fastify, projectId);
    const ownerId = owners[0];
    if (!ownerId) return reply.code(404).send({ error: "Project not found" });

    const project = await fastify.store.getProject(ownerId, projectId);
    if (!project) return reply.code(404).send({ error: "Project not found" });
    const costings = await fastify.store.listCostings(ownerId, projectId);
    const standard =
      costings.find((c) => c.scenario === "standard") ?? costings[0];
    if (!standard) {
      return reply
        .code(409)
        .send({ error: "Costing required before deposit." });
    }

    const portalBase =
      process.env.PORTAL_BASE_URL ?? "https://construct.example/portal";
    try {
      const session = await createDepositSession({
        project,
        costing: standard,
        deposit_pct: Number(process.env.DEPOSIT_PCT ?? 20),
        success_url: `${portalBase}/deposit-success`,
        cancel_url: `${portalBase}/deposit-cancel`,
      });
      return reply.send({ session });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe failed";
      request.log.error(err);
      return reply.code(502).send({ error: message });
    }
  });
}

// Helper: the in-memory store doesn't expose project ownership lookup. Walk
// through known owners (currently just "dev-user" + any Clerk user ids that
// have created projects) to find the project. Acceptable for the single-tenant
// demo; revisit when persistence moves to Postgres.
async function listAllOwnersForProject(
  fastify: FastifyInstance,
  projectId: string,
): Promise<string[]> {
  const owners: string[] = [];
  const candidates = ["dev-user"];
  for (const ownerId of candidates) {
    const project = await fastify.store.getProject(ownerId, projectId);
    if (project) owners.push(ownerId);
  }
  return owners;
}
