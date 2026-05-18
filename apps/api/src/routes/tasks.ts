import { FastifyInstance } from "fastify";
import {
  CreateTaskInputSchema,
  UpdateTaskStatusInputSchema,
} from "@construct/contracts";
import { requireAuth } from "../plugins/auth";

export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/tasks",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const tasks = await fastify.store.listTasks(request.userId!, projectId);
      return reply.send({ tasks });
    },
  );

  fastify.post(
    "/:projectId/tasks",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
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
    "/tasks/:taskId/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      const parsed = UpdateTaskStatusInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const task = await fastify.store.updateTaskStatus(
        request.userId!,
        taskId,
        parsed.data.status,
      );
      if (!task) return reply.code(404).send({ error: "Task not found" });
      return reply.send({ task });
    },
  );
}
