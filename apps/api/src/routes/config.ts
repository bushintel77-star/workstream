import { FastifyInstance } from "fastify";
import { getOwnerEnv } from "../lib/owner-secrets";

/** MapLibre-compatible styles (web also normalizes any legacy mapbox:// URLs). */
const STREETS_STYLE = "https://demotiles.maplibre.org/style.json";
/** Relative to the web app — Esri World Imagery raster style JSON. */
const SATELLITE_STYLE = "/api/map-style/satellite";

/**
 * Public MapLibre GL config for the geo canvas.
 * Token optional (demotiles / free rasters). Still returns pk.* when set —
 * never secret sk.* keys.
 */
export default async function configRoutes(fastify: FastifyInstance) {
  fastify.get("/map", async (_request, reply) => {
    const token = (getOwnerEnv("MAPBOX_TOKEN") ?? "").trim();
    const publicToken = token.startsWith("pk.") ? token : null;
    return reply.send({
      token: publicToken,
      styles: {
        satellite: SATELLITE_STYLE,
        streets: STREETS_STYLE,
      },
      default_style: SATELLITE_STYLE,
    });
  });
}
