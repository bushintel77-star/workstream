import { FastifyInstance } from "fastify";
import {
  CreateProjectInputSchema,
  UpdateProjectClientInputSchema,
  UpdateProjectStatusInputSchema,
} from "@workstream/contracts";
import { requireAuth } from "../plugins/auth";
import { getEnvelopeBrief } from "../lib/envelope-job";
import { dispatchProjectCreated } from "../lib/integration-dispatch";

export default async function projectRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: requireAuth }, async (request, reply) => {
    const projects = await fastify.store.listProjects(request.userId!);
    return reply.send({ projects });
  });

  fastify.post("/", { preHandler: requireAuth }, async (request, reply) => {
    const result = CreateProjectInputSchema.safeParse(request.body);
    if (!result.success) {
      return reply
        .code(400)
        .send({ error: "Validation failed", issues: result.error.issues });
    }
    const project = await fastify.store.createProject(
      request.userId!,
      result.data
    );
    void dispatchProjectCreated(
      fastify.store,
      request.userId!,
      project,
    ).catch(() => {});
    return reply.code(201).send({ project });
  });

  fastify.get("/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await fastify.store.getProject(request.userId!, id);
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }
    return reply.send({ project });
  });

  fastify.get(
    "/:id/envelope",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const envelope = await getEnvelopeBrief(
        fastify.store,
        request.userId!,
        id,
      );
      if (!envelope) {
        return reply.code(404).send({
          error: "Project or survey not found — run survey first",
        });
      }
      return reply.send({ envelope });
    },
  );

  fastify.patch(
    "/:id/client",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateProjectClientInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const project = await fastify.store.updateProjectClient(
        request.userId!,
        id,
        parsed.data,
      );
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }
      return reply.send({ project });
    },
  );

  fastify.patch(
    "/:id/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateProjectStatusInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Validation failed", issues: parsed.error.issues });
      }
      const project = await fastify.store.updateProjectStatus(
        request.userId!,
        id,
        parsed.data.status,
      );
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }
      return reply.send({ project });
    },
  );

  fastify.delete(
    "/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const ok = await fastify.store.deleteProject(request.userId!, id);
      if (!ok) {
        return reply.code(404).send({ error: "Project not found" });
      }
      return reply.code(204).send();
    },
  );

  fastify.post(
    "/:id/restore",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const project = await fastify.store.restoreProject(request.userId!, id);
      if (!project) {
        return reply.code(404).send({ error: "Project not found or not deleted" });
      }
      return reply.send({ project });
    },
  );
}
