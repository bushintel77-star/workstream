import { FastifyInstance } from "fastify";
import {
  AcceptOverlayInputSchema,
  DismissOverlayInputSchema,
  ProjectOrchestrationWorldSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";
import {
  acceptOverlay,
  dismissOverlay,
  getOrchestrationWorld,
  refreshOrchestration,
} from "../lib/material-orchestrator";

export default async function orchestrationRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/orchestration",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const world = await getOrchestrationWorld(
        fastify.store,
        ownerId,
        projectId,
      );
      return reply.send(ProjectOrchestrationWorldSchema.parse(world));
    },
  );

  fastify.post(
    "/:projectId/orchestration/refresh",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const world = await refreshOrchestration(
        fastify.store,
        ownerId,
        projectId,
      );
      return reply.send(ProjectOrchestrationWorldSchema.parse(world));
    },
  );

  fastify.post(
    "/:projectId/orchestration/accept-overlay",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = AcceptOverlayInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const result = await acceptOverlay(
        fastify.store,
        ownerId,
        projectId,
        parsed.data.proposal_id,
      );
      if (!result.overlay) {
        return reply.code(404).send({ error: "Overlay proposal not found" });
      }
      return reply.send({
        world: ProjectOrchestrationWorldSchema.parse(result.world),
        placed: result.placed,
      });
    },
  );

  fastify.post(
    "/:projectId/orchestration/dismiss-overlay",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = DismissOverlayInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const world = await dismissOverlay(
        fastify.store,
        ownerId,
        projectId,
        parsed.data.proposal_id,
      );
      return reply.send(ProjectOrchestrationWorldSchema.parse(world));
    },
  );
}
