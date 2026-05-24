import { FastifyInstance } from "fastify";
import {
  CreateTaskInputSchema,
  UpdateTaskStatusInputSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { notifyTaskAssignment } from "../lib/task-notify";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/tasks",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const tasks = await fastify.store.listTasks(ownerId, projectId);
      return reply.send({ tasks });
    },
  );

  fastify.post(
    "/:projectId/tasks",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = CreateTaskInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      try {
        const task = await fastify.store.createTask(
          request.userId!,
          projectId,
          parsed.data,
        );
        void notifyTaskAssignment(fastify.store, request.userId!, task);
        return reply.code(201).send({ task });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        if (message.startsWith("Project not found")) {
          return reply.code(404).send({ error: message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.patch(
    "/:projectId/tasks/:taskId/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId, taskId } = request.params as {
        projectId: string;
        taskId: string;
      };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }
      const parsed = UpdateTaskStatusInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const tasks = await fastify.store.listTasks(ownerId, projectId);
      if (!tasks.some((t) => t.id === taskId)) {
        return reply.code(404).send({ error: "Task not found" });
      }
      const task = await fastify.store.updateTaskStatus(
        ownerId,
        taskId,
        parsed.data.status,
      );
      if (!task) return reply.code(404).send({ error: "Task not found" });
      return reply.send({ task });
    },
  );
}
