import { FastifyInstance } from "fastify";
import {
  CreateDesignBranchInputSchema,
  CommitDesignBranchInputSchema,
  MergeDesignBranchInputSchema,
  DesignBranchCheckoutSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import { diffDesignCanvas } from "@workstream/domain";

export default async function designBranchRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/design-branches",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const branches = await fastify.store.listDesignBranches(ownerId, projectId);
      return reply.send({ branches });
    },
  );

  fastify.post(
    "/:projectId/design-branches",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const parsed = CreateDesignBranchInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const created = await fastify.store.createDesignBranch(
          ownerId,
          projectId,
          parsed.data,
          ownerId,
        );
        return reply.code(201).send(created);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Create failed";
        return reply.code(400).send({ error: msg });
      }
    },
  );

  fastify.get(
    "/:projectId/design-branches/:branchId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, branchId } = request.params as {
        projectId: string;
        branchId: string;
      };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const branch = await fastify.store.getDesignBranch(
        ownerId,
        projectId,
        branchId,
      );
      if (!branch) return reply.code(404).send({ error: "Branch not found" });
      const canvas = await fastify.store.getDesignCanvas(ownerId, projectId, {
        branchId,
      });
      return reply.send({ branch, canvas });
    },
  );

  fastify.post(
    "/:projectId/design-branches/:branchId/checkout",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, branchId } = request.params as {
        projectId: string;
        branchId: string;
      };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const parsed = DesignBranchCheckoutSchema.safeParse({
        branch_id: branchId,
      });
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid branch" });
      }
      const branch = await fastify.store.getDesignBranch(
        ownerId,
        projectId,
        branchId,
      );
      if (!branch) return reply.code(404).send({ error: "Branch not found" });
      if (branch.status !== "open") {
        return reply
          .code(409)
          .send({ error: `Branch is ${branch.status}` });
      }
      const canvas = await fastify.store.getDesignCanvas(ownerId, projectId, {
        branchId,
      });
      return reply.send({ branch, canvas });
    },
  );

  fastify.post(
    "/:projectId/design-branches/:branchId/commit",
    { preHandler: requireAuth, bodyLimit: 10 * 1024 * 1024 },
    async (request, reply) => {
      const { projectId, branchId } = request.params as {
        projectId: string;
        branchId: string;
      };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const parsed = CommitDesignBranchInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const revision = await fastify.store.commitDesignBranch(
          ownerId,
          projectId,
          branchId,
          parsed.data,
          ownerId,
        );
        return reply.send({ revision });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Commit failed";
        return reply.code(400).send({ error: msg });
      }
    },
  );

  fastify.post(
    "/:projectId/design-branches/:branchId/abandon",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, branchId } = request.params as {
        projectId: string;
        branchId: string;
      };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      try {
        const branch = await fastify.store.abandonDesignBranch(
          ownerId,
          projectId,
          branchId,
        );
        if (!branch) return reply.code(404).send({ error: "Branch not found" });
        return reply.send({ branch });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Abandon failed";
        return reply.code(400).send({ error: msg });
      }
    },
  );

  fastify.get(
    "/:projectId/design-branches/:branchId/diff",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, branchId } = request.params as {
        projectId: string;
        branchId: string;
      };
      const q = request.query as { against?: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const branches = await fastify.store.listDesignBranches(ownerId, projectId);
      const main = branches.find((b) => b.name === "main");
      const againstId = q.against ?? main?.id;
      if (!againstId) {
        return reply.code(400).send({ error: "No against branch" });
      }
      const tips = await fastify.store.diffDesignBranches(
        ownerId,
        projectId,
        againstId,
        branchId,
      );
      const diff = diffDesignCanvas(tips.left, tips.right);
      return reply.send({
        against_branch_id: againstId,
        branch_id: branchId,
        base: tips.base,
        against_canvas: tips.left,
        branch_canvas: tips.right,
        diff,
      });
    },
  );

  fastify.post(
    "/:projectId/design-branches/:branchId/merge",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, branchId } = request.params as {
        projectId: string;
        branchId: string;
      };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      const parsed = MergeDesignBranchInputSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const result = await fastify.store.mergeDesignBranch(
          ownerId,
          projectId,
          branchId,
          parsed.data,
          ownerId,
        );
        if (!result.ok) {
          return reply.code(409).send({
            error: "Merge conflicts",
            conflicts: result.conflicts,
          });
        }
        return reply.send(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Merge failed";
        return reply.code(400).send({ error: msg });
      }
    },
  );
}
