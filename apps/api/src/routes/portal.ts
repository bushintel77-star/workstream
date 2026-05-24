import { FastifyInstance } from "fastify";
import {
  isTier1WrightsTerrace,
  TIER1_WRIGHTS_SAVINGS,
} from "@workstream/domain";
import { requireAuth } from "../plugins/auth";
import {
  buildPortalUrl,
  signPortalToken,
  verifyPortalToken,
} from "../lib/magic-link";
import { createDepositSession } from "../lib/stripe";
import { bindOwnerSecrets } from "../lib/owner-secrets";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function portalRoutes(fastify: FastifyInstance) {
  // --- Authed: studio side ---
  fastify.post(
    "/projects/:projectId/magic-link",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const { scope } = (request.body ?? {}) as { scope?: string };
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
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
      const portalUrl = buildPortalUrl(validScope, token);
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
    const ownerId = await fastify.store.resolveProjectOwner(projectId);
    if (!ownerId) return reply.code(404).send({ error: "Project not found" });

    const project = await fastify.store.getProject(ownerId, projectId);
    const survey = await fastify.store.getSurvey(ownerId, projectId);
    const design = await fastify.store.getDesign(ownerId, projectId);
    const costings = await fastify.store.listCostings(ownerId, projectId);
    const standard =
      costings.find((c) => c.scenario === "standard") ?? costings[0];
    const tier1 = isTier1WrightsTerrace(project?.address ?? "")
      ? TIER1_WRIGHTS_SAVINGS
      : null;
    const heroUrl =
      survey?.aerial_uri &&
      survey.aerial_uri.startsWith("http") &&
      !survey.aerial_uri.includes("placeholder")
        ? survey.aerial_uri
        : null;

    return reply.send({
      project,
      survey,
      design,
      costing: standard,
      costings,
      tier1,
      hero_url: heroUrl,
    });
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
    const ownerId = await fastify.store.resolveProjectOwner(projectId);
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

    const portalBase = (
      process.env.PORTAL_BASE_URL ?? "http://localhost:3002"
    ).replace(/\/$/, "");
    try {
      await bindOwnerSecrets(fastify.store, ownerId);
      const session = await createDepositSession({
        project,
        costing: standard,
        owner_id: ownerId,
        deposit_pct: Number(process.env.DEPOSIT_PCT ?? 20),
        success_url: `${portalBase}/portal/deposit-success`,
        cancel_url: `${portalBase}/portal/deposit-cancel`,
      });
      return reply.send({ session });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe failed";
      request.log.error(err);
      return reply.code(502).send({ error: message });
    }
  });
}
