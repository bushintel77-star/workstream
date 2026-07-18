/**
 * Free MapLibre-compatible satellite raster style (Esri World Imagery).
 * Streets use demotiles / OpenFreeMap from /api/map-config — no token required.
 * Swap tiles here if Esri ToS or rate limits become an issue (e.g. USGS NAIP).
 */
const SATELLITE_STYLE = {
  version: 8 as const,
  name: "Curtis satellite (Esri World Imagery)",
  sources: {
    esri: {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "esri-satellite",
      type: "raster" as const,
      source: "esri",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export async function GET() {
  return Response.json(SATELLITE_STYLE, {
    headers: {
      "Cache-Control": "public, max-age=86400",
    },
  });
}
