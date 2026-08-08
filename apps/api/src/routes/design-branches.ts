import { FastifyInstance } from "fastify";
import {
  ActivateDesignBranchInputSchema,
  FreezeDesignBranchInputSchema,
  ListDesignBranchesResponseSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function designBranchRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/design-branches",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const branches = await fastify.store.listDesignBranches(
        ownerId,
        projectId,
      );
      const active = branches.find((b) => b.active);
      return reply.send(
        ListDesignBranchesResponseSchema.parse({
          branches,
          active_id: active?.id ?? null,
        }),
      );
    },
  );

  fastify.post(
    "/:projectId/design-branches/freeze",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = FreezeDesignBranchInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      await fastify.store.freezeDesignBranch(ownerId, projectId, parsed.data);
      const branches = await fastify.store.listDesignBranches(
        ownerId,
        projectId,
      );
      const active = branches.find((b) => b.active);
      return reply.send(
        ListDesignBranchesResponseSchema.parse({
          branches,
          active_id: active?.id ?? null,
        }),
      );
    },
  );

  fastify.post(
    "/:projectId/design-branches/activate",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = ActivateDesignBranchInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const activated = await fastify.store.activateDesignBranch(
        ownerId,
        projectId,
        parsed.data.branch_id,
      );
      if (!activated) {
        return reply.code(404).send({ error: "Branch not found" });
      }
      const { refreshOrchestration } = await import(
        "../lib/material-orchestrator"
      );
      await refreshOrchestration(fastify.store, ownerId, projectId);
      const branches = await fastify.store.listDesignBranches(
        ownerId,
        projectId,
      );
      return reply.send(
        ListDesignBranchesResponseSchema.parse({
          branches,
          active_id: activated.id,
        }),
      );
    },
  );
}
