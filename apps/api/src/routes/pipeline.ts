import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { runFullPipeline } from "../lib/pipeline-job";
import { runDevelopFromSketchPipeline } from "../lib/develop-pipeline";
import { enqueuePipelineJob } from "../lib/queue";
import {
  getIdempotentPipelineResponse,
  pipelineIdempotencyKey,
  readIdempotencyHeader,
  setIdempotentPipelineResponse,
} from "../lib/pipeline-idempotency";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

export default async function pipelineRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:projectId/pipeline/develop",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      void runDevelopFromSketchPipeline(fastify.store, ownerId, projectId).catch(
        (err) => {
          request.log.error(err, "develop-from-sketch pipeline failed");
        },
      );

      return reply.code(202).send({ accepted: true, pipeline: "develop" });
    },
  );

  fastify.post(
    "/:projectId/pipeline",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const idempotencyKey = readIdempotencyHeader(
        request.headers["idempotency-key"],
      );
      if (idempotencyKey) {
        const cacheKey = pipelineIdempotencyKey(
          ownerId,
          projectId,
          idempotencyKey,
        );
        const cached = getIdempotentPipelineResponse(cacheKey);
        if (cached) {
          return reply.code(202).send(cached);
        }
      }

      // Kick off the pipeline in the background; the client observes progress
      // by polling the project's status + child resources. Errors are logged
      // but don't propagate to the HTTP response.
      const queued = await enqueuePipelineJob({
        kind: "pipeline",
        ownerId,
        projectId,
      });
      if (queued.enqueued) {
        const body = {
          accepted: true,
          queued: true,
          jobId: queued.jobId,
        };
        if (idempotencyKey) {
          setIdempotentPipelineResponse(
            pipelineIdempotencyKey(ownerId, projectId, idempotencyKey),
            body,
          );
        }
        return reply.code(202).send(body);
      }

      void runFullPipeline(fastify.store, ownerId, projectId).catch((err) => {
        request.log.error(err, "background pipeline failed");
      });

      const body = { accepted: true };
      if (idempotencyKey) {
        setIdempotentPipelineResponse(
          pipelineIdempotencyKey(ownerId, projectId, idempotencyKey),
          body,
        );
      }
      return reply.code(202).send(body);
    },
  );
}
