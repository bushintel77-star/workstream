import { FastifyInstance } from "fastify";
import type { Store } from "@workstream/db";
import {
  isTier1WrightsTerrace,
  TIER1_WRIGHTS_SAVINGS,
} from "@workstream/domain";
import { requireAuth } from "../plugins/auth";
import {
  buildPortalUrl,
  portalBaseUrl,
  signPortalToken,
  verifyPortalToken,
} from "../lib/magic-link";
import { createDepositSession } from "../lib/stripe";
import { bindOwnerSecrets } from "../lib/owner-secrets";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

/**
 * Minimized public quote payload — the client portal gets presentation data
 * only, never internal operator records (client emails, CRM stage, audit
 * findings, cost overrides, or other project internals carried by the raw
 * store rows).
 */
function toPublicQuotePayload(input: {
  project: NonNullable<Awaited<ReturnType<Store["getProject"]>>>;
  survey: Awaited<ReturnType<Store["getSurvey"]>>;
  design: Awaited<ReturnType<Store["getDesign"]>>;
  costings: Awaited<ReturnType<Store["listCostings"]>>;
  standard: Awaited<ReturnType<Store["listCostings"]>>[number] | undefined;
  deposit_url: string | null;
  tier1: typeof TIER1_WRIGHTS_SAVINGS | null;
  hero_url: string | null;
}) {
  const costing = (c: (typeof input.costings)[number]) => ({
    scenario: c.scenario,
    subtotal: c.subtotal,
    gst: c.gst,
    total: c.total,
    line_items: c.line_items.map((li) => ({
      label: li.label,
      qty: li.qty,
      unit: li.unit,
      rate: li.rate,
      total: li.total,
      is_provisional: li.is_provisional,
      ...(li.sku ? { sku: li.sku } : {}),
    })),
    ...(c.assumptions ? { assumptions: c.assumptions } : {}),
  });
  return {
    project: {
      id: input.project.id,
      address: input.project.address,
      created_at: input.project.created_at,
    },
    survey: input.survey
      ? {
          lot_area_m2: input.survey.lot_area_m2,
          house_area_m2: input.survey.house_area_m2,
          garden_area_m2: input.survey.garden_area_m2,
        }
      : null,
    design: input.design
      ? {
          rationale: input.design.rationale,
          proposal: {
            zones: (input.design.proposal?.zones ?? []).map((z) => ({
              id: z.id,
              name: z.name,
              treatment: z.treatment,
            })),
          },
        }
      : null,
    costing: input.standard ? costing(input.standard) : null,
    costings: input.costings.map(costing),
    deposit_url: input.deposit_url,
    tier1: input.tier1,
    hero_url: input.hero_url,
  };
}

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
  fastify.get("/portal/quote/*", {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute",
      },
    },
  }, async (request, reply) => {
    const { "*": token } = request.params as { "*": string };
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
    const depositUrl = standard
      ? buildPortalUrl(
          "deposit_checkout",
          signPortalToken({
            project_id: projectId,
            scope: "deposit_checkout",
          }),
        )
      : null;
    const tier1 = isTier1WrightsTerrace(project?.address ?? "")
      ? TIER1_WRIGHTS_SAVINGS
      : null;
    const heroUrl =
      survey?.aerial_uri &&
      survey.aerial_uri.startsWith("http") &&
      !survey.aerial_uri.includes("placeholder")
        ? survey.aerial_uri
        : null;

    return reply.send(
      toPublicQuotePayload({
        project: project!,
        survey,
        design,
        costings,
        standard,
        deposit_url: depositUrl,
        tier1,
        hero_url: heroUrl,
      }),
    );
  });

  fastify.post("/portal/deposit/*", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
      },
    },
  }, async (request, reply) => {
    const { "*": token } = request.params as { "*": string };
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
    const q = request.query as { scenario?: string };
    const wanted =
      q.scenario === "lean" ||
      q.scenario === "standard" ||
      q.scenario === "buffer"
        ? q.scenario
        : "standard";
    const costing =
      costings.find((c) => c.scenario === wanted) ??
      costings.find((c) => c.scenario === "standard") ??
      costings[0];
    if (!costing) {
      return reply
        .code(409)
        .send({ error: "Costing required before deposit." });
    }

    const portalBase = portalBaseUrl();
    try {
      await bindOwnerSecrets(fastify.store, ownerId);
      const session = await createDepositSession({
        project,
        costing,
        owner_id: ownerId,
        deposit_pct: Number(process.env.DEPOSIT_PCT ?? 20),
        success_url: `${portalBase}/portal/deposit-success`,
        cancel_url: `${portalBase}/portal/deposit-cancel`,
      });
      return reply.send({
        session,
        scenario: costing.scenario,
      });
    } catch (err) {
      request.log.error({ err }, "Stripe failed");
      return reply.code(502).send({ error: "Stripe failed" });
    }
  });
}
