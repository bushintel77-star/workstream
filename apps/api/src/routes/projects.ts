import { FastifyInstance } from "fastify";
import { CreateProjectInputSchema } from "@walkthrough/contracts";
import { requireAuth } from "../plugins/auth";

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
}
