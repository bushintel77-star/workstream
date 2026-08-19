import { FastifyInstance } from "fastify";
import type { GeoJsonPolygon } from "@workstream/contracts";
import { fetchBuildingPolygon, fetchTitlePolygon } from "../lib/vicmap";

/**
 * Public (keyless) cadastral hero feed — the marketing landing renders a
 * real Vicmap title boundary over the Stonnington aerial. Same pipeline as
 * the studio: INTERSECTS from a pin, Vicmap Property layer, EPSG:4326.
 * Anonymous because the upstream GeoServer is itself keyless; failures
 * degrade to `polygon: null` and the landing simply omits the overlay.
 */
export default async function geoHeroRoutes(fastify: FastifyInstance) {
  fastify.get("/hero", async (request, reply) => {
    const { lat, lng } = (request.query ?? {}) as {
      lat?: string;
      lng?: string;
    };
    const latN = Number(lat);
    const lngN = Number(lng);
    if (
      !Number.isFinite(latN) ||
      !Number.isFinite(lngN) ||
      latN < -90 ||
      latN > 90 ||
      lngN < -180 ||
      lngN > 180
    ) {
      return reply
        .code(400)
        .send({ error: "lat and lng are required as decimal degrees" });
    }

    try {
      const polygon: GeoJsonPolygon | null = await fetchTitlePolygon(
        latN,
        lngN,
      );
      if (!polygon) return reply.send({ polygon: null, building: null });

      let building: GeoJsonPolygon | null = null;
      try {
        building = await fetchBuildingPolygon(polygon.coordinates[0]);
      } catch {
        building = null;
      }
      return reply.send({ polygon, building });
    } catch {
      return reply.code(502).send({
        error: "Upstream cadastre unavailable",
        polygon: null,
        building: null,
      });
    }
  });
}
