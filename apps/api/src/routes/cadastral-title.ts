import { FastifyInstance } from "fastify";
import { buildArchitecturalTitleBlock } from "@workstream/domain";
import { requireAuth } from "../plugins/auth";
import { geocodeAddress } from "../lib/mapbox";
import { fetchTitleParcel } from "../lib/vicmap";
import { getOwnedProject, PROJECT_NOT_FOUND_BODY } from "../lib/project-guard";

/**
 * Architectural title block · Vicmap cadastral (keyless DELWP GeoServer WFS).
 * Query `address` overrides the project address (demo site switcher).
 */
export default async function cadastralTitleRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:projectId/cadastral-title",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const q = request.query as { address?: string };
      const ownerId = request.userId!;
      const project = await getOwnedProject(fastify.store, ownerId, projectId);
      if (!project) {
        return reply.code(404).send(PROJECT_NOT_FOUND_BODY);
      }

      const address = (q.address?.trim() || project.address).trim();
      const survey = await fastify.store.getSurvey(ownerId, projectId);

      let parcel = null;
      let vicmapHit = false;

      try {
        const sameAsProject =
          address.toLowerCase() === project.address.toLowerCase();
        const center =
          sameAsProject && project.lat != null && project.lng != null
            ? { lat: project.lat, lng: project.lng }
            : await geocodeAddress(address);
        const hit = await fetchTitleParcel(center.lat, center.lng);
        if (hit) {
          parcel = hit.attrs;
          vicmapHit = true;
        }
      } catch (err) {
        request.log.warn({ err }, "Vicmap cadastral-title lookup failed");
      }

      const titleBlock = buildArchitecturalTitleBlock({
        address,
        parcel,
        vicmapHit,
        survey: survey
          ? {
              lot_area_m2: survey.lot_area_m2,
              garden_area_m2: survey.garden_area_m2,
              house_area_m2: survey.house_area_m2,
            }
          : null,
      });

      return reply.send({ titleBlock });
    },
  );
}
