"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  canvasMetresToGeo,
  deleteBoundaryVertex,
  designableFocusRing,
  geoToCanvasMetres,
  insertBoundaryVertex,
  moveBoundaryVertex,
  outsideMask,
} from "@workstream/domain";
import type { SiteBoundaryLite } from "../../lib/canvas-types";
import {
  castBuildingShadow,
  dateAtMinutes,
  formatSunClock,
  minutesOfDay,
  sunCastAt,
  sunDayBounds,
} from "../../lib/sun-shadow";
import type { BoundaryTool } from "./BoundaryLockSnap";
import {
  FitSheetLayer,
  type FitSheetEdge,
  type FitSheetMeta,
} from "./FitSheetLayer";
import css from "./geoSiteMap.module.css";

type DomainBoundary = Parameters<typeof moveBoundaryVertex>[0];

function toDomain(b: SiteBoundaryLite): DomainBoundary {
  return b as unknown as DomainBoundary;
}

function fromDomain(b: DomainBoundary): SiteBoundaryLite {
  return b as unknown as SiteBoundaryLite;
}

type Ring = [number, number][];

function openRing(ring: Ring): Ring {
  if (ring.length < 2) return ring;
  const a = ring[0]!;
  const b = ring[ring.length - 1]!;
  if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  return ring;
}

function closeRing(ring: Ring): Ring {
  const open = openRing(ring);
  if (open.length < 3) return open;
  const first = open[0]!;
  return [...open, first];
}

type PolygonFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: Ring[] };
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: PolygonFeature[];
};

function ringFromBoundary(boundary: SiteBoundaryLite | null): Ring {
  if (!boundary?.vertices.length) return [];
  return boundary.vertices
    .slice()
    .sort((a, b) => a.sequence_index - b.sequence_index)
    .map((v) => [v.geo_coords.lng, v.geo_coords.lat] as [number, number]);
}

function centroidOf(ring: Ring): { lng: number; lat: number } {
  const pts = openRing(ring);
  if (!pts.length) return { lng: 144.9631, lat: -37.8136 };
  const lng = pts.reduce((s, c) => s + c[0], 0) / pts.length;
  const lat = pts.reduce((s, c) => s + c[1], 0) / pts.length;
  return { lng, lat };
}

export type GeoSiteMapProps = {
  styleSatellite: string;
  styleStreets: string;
  boundary: SiteBoundaryLite | null;
  /** Vicmap survey ring when boundary not yet created. */
  lotRing?: Ring;
  fallbackCenter?: { lng: number; lat: number } | null;
  tool: BoundaryTool;
  onBoundaryChange: (next: SiteBoundaryLite) => void;
  /** Increment to re-fit camera to parcel. */
  fitNonce?: number;
  /** Optional CAD SVG in lot-metre space (origin SW, Y-up). */
  cadSvg?: string | null;
  cadWidthM?: number | null;
  cadHeightM?: number | null;
  /** Sketch / design layer — projected onto the title parcel frame. */
  designOverlay?: ReactNode;
  /** When false, map pan is off (e.g. sketch brush armed). */
  allowMapPan?: boolean;
  /** Vicmap / survey building footprint for sun cast. */
  houseRing?: Ring;
  /** Eave / ridge height used for shadow length (metres). */
  buildingHeightM?: number;
  /**
   * Inside ArchitecturalSheet — hide floating GIS chrome; map fills
   * the drawing field only.
   */
  sheetMode?: boolean;
  /**
   * Progressive disclosure:
   * - title = world tinted out, only Vicmap outline; click to enter
   * - design = garden drawing open, CAD/sketch ready
   */
  phase?: "title" | "design";
  onTitleOpen?: () => void;
  /** Click-to-draw CAD polylines in lot-metre space (origin SW, Y-up). */
  lineDrawActive?: boolean;
  onLineCommit?: (points: { x: number; y: number }[]) => void;
  /**
   * Fit sheet = paper working-drawing mode (Design Studio v3):
   * cream sheet, ink geometry, aerial hidden. Not a glass overlay.
   */
  paperMode?: boolean;
  fitSheetMeta?: FitSheetMeta | null;
  /** Parcel edge dimensions on Fit sheet chrome (default on). */
  fitSheetShowDims?: boolean;
  className?: string;
};

const SRC_DRAW = "ws-cad-draw";
const LY_DRAW_LINE = "ws-cad-draw-line";
const LY_DRAW_PTS = "ws-cad-draw-pts";

const SRC_PARCEL = "ws-parcel";
const SRC_MASK = "ws-parcel-mask";
const SRC_HOUSE = "ws-house";
const SRC_SHADOW = "ws-shadow";
const LY_FILL = "ws-parcel-fill";
const LY_LINE = "ws-parcel-line";
const LY_MASK = "ws-parcel-mask-fill";
const LY_HOUSE_FILL = "ws-house-fill";
const LY_HOUSE_LINE = "ws-house-line";
const LY_SHADOW = "ws-shadow-fill";

/** Continuous zoom — tiles soft-limit ~22; vectors keep scaling past that. */
const MAP_MIN_ZOOM = 12;
const MAP_MAX_ZOOM = 24;

export function GeoSiteMap({
  styleSatellite,
  styleStreets,
  boundary,
  lotRing = [],
  fallbackCenter = null,
  tool,
  onBoundaryChange,
  fitNonce = 0,
  cadSvg = null,
  cadWidthM = null,
  cadHeightM = null,
  designOverlay = null,
  allowMapPan = true,
  houseRing = [],
  buildingHeightM = 5,
  sheetMode = false,
  phase = "design",
  onTitleOpen,
  lineDrawActive = false,
  onLineCommit,
  paperMode = false,
  fitSheetMeta = null,
  fitSheetShowDims = true,
  className,
}: GeoSiteMapProps) {
  const titleOnly = phase === "title";
  const onTitleOpenRef = useRef(onTitleOpen);
  onTitleOpenRef.current = onTitleOpen;
  const onLineCommitRef = useRef(onLineCommit);
  onLineCommitRef.current = onLineCommit;
  const [draftPts, setDraftPts] = useState<[number, number][]>([]);
  const draftPtsRef = useRef(draftPts);
  draftPtsRef.current = draftPts;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cadRef = useRef<HTMLDivElement | null>(null);
  const designRef = useRef<HTMLDivElement | null>(null);
  const fitSheetRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const midMarkersRef = useRef<maplibregl.Marker[]>([]);
  const draggingRef = useRef(false);
  const boundaryRef = useRef(boundary);
  boundaryRef.current = boundary;
  const [basemap, setBasemap] = useState<"satellite" | "streets">("satellite");
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sunEnabled, setSunEnabled] = useState(true);
  const [sunDay] = useState(() => new Date());
  /** null = use solar noon once day bounds are known */
  const [sunMinutes, setSunMinutes] = useState<number | null>(null);
  const vertexKey = useMemo(() => {
    if (!boundary) return "";
    return boundary.vertices
      .map((v) => v.vertex_id)
      .sort()
      .join("|");
  }, [boundary]);

  const locked = boundary?.status === "VERIFIED";
  /**
   * Prefer survey Vicmap lotRing when present — it's the fresh Land Vic
   * polygon. Boundary vertices can drift after edits / canvas sync.
   */
  const parcelRing = useMemo(() => {
    if (lotRing.length >= 3) return openRing(lotRing);
    const fromBoundary = ringFromBoundary(boundary);
    if (fromBoundary.length >= 3) return fromBoundary;
    return [];
  }, [boundary, lotRing]);

  /** Camera / “zoom to design” target = garden, not the whole black map. */
  const focusRing = useMemo(
    () =>
      designableFocusRing(
        parcelRing,
        houseRing.length >= 3 ? [houseRing] : [],
      ),
    [parcelRing, houseRing],
  );

  const center = useMemo(() => {
    if (focusRing.length >= 3) return centroidOf(focusRing);
    if (parcelRing.length >= 3) return centroidOf(parcelRing);
    if (fallbackCenter) return fallbackCenter;
    return { lng: 144.9631, lat: -37.8136 };
  }, [focusRing, parcelRing, fallbackCenter]);

  const siteLat = center.lat;
  const siteLng = center.lng;

  const dayBounds = useMemo(
    () => sunDayBounds(sunDay, siteLat, siteLng),
    [sunDay, siteLat, siteLng],
  );

  const solarNoon = Math.round(
    (dayBounds.sunriseMin + dayBounds.sunsetMin) / 2,
  );

  const sunMinutesClamped = useMemo(() => {
    const raw = sunMinutes ?? solarNoon;
    return Math.min(
      dayBounds.sunsetMin,
      Math.max(dayBounds.sunriseMin, raw),
    );
  }, [sunMinutes, solarNoon, dayBounds.sunriseMin, dayBounds.sunsetMin]);

  const sunDate = useMemo(
    () => dateAtMinutes(sunDay, sunMinutesClamped),
    [sunDay, sunMinutesClamped],
  );

  const sunInfo = useMemo(
    () => sunCastAt(sunDate, siteLat, siteLng),
    [sunDate, siteLat, siteLng],
  );

  const shadowRing = useMemo(() => {
    if (!sunEnabled || houseRing.length < 3) return null;
    return castBuildingShadow(
      houseRing,
      buildingHeightM,
      sunDate,
      siteLat,
      siteLng,
    );
  }, [
    sunEnabled,
    houseRing,
    buildingHeightM,
    sunDate,
    siteLat,
    siteLng,
  ]);

  const fitToGarden = useCallback(
    (map: maplibregl.Map, ring: Ring, opts?: { lockBounds?: boolean }) => {
      const open = openRing(ring);
      if (open.length < 3) return;
      const bounds = new maplibregl.LngLatBounds();
      for (const [lng, lat] of open) bounds.extend([lng, lat]);
      map.fitBounds(bounds, {
        padding: titleOnly
          ? { top: 72, bottom: 96, left: 56, right: 56 }
          : sheetMode
            ? { top: 16, bottom: 56, left: 16, right: 16 }
            : { top: 48, bottom: 120, left: 32, right: 32 },
        maxZoom: titleOnly ? 19 : 22,
        duration: 700,
      });
      if (opts?.lockBounds !== false && !titleOnly) {
        const pad = 0.00012;
        map.setMaxBounds([
          [bounds.getWest() - pad, bounds.getSouth() - pad],
          [bounds.getEast() + pad, bounds.getNorth() + pad],
        ]);
      } else {
        map.setMaxBounds(null as unknown as maplibregl.LngLatBoundsLike);
      }
    },
    [sheetMode, titleOnly],
  );

  const outsideDim = (_isLocked: boolean) => {
    // Title reveal: almost everything black except the outline.
    if (titleOnly) return 0.88;
    // Fit sheet: cream paper outside the lot — aerial gone.
    if (paperMode) return 0;
    if (basemap === "streets") return 0.72;
    return 0.62;
  };

  const syncLayers = useCallback(
    (map: maplibregl.Map, ring: Ring, isLocked: boolean) => {
      const open = openRing(ring);
      const closed = open.length >= 3 ? closeRing(open) : null;
      const parcelFc: FeatureCollection = {
        type: "FeatureCollection",
        features: closed
          ? [
              {
                type: "Feature",
                properties: { locked: isLocked },
                geometry: { type: "Polygon", coordinates: [closed] },
              },
            ]
          : [],
      };
      /** Title canvas = the lot. Soft-dim outside even in draft. */
      const maskFc: FeatureCollection = {
        type: "FeatureCollection",
        features: (() => { const m = closed ? outsideMask(open) : null; return m ? [m as PolygonFeature] : []; })(),
      };
      const dim = outsideDim(isLocked);

      const parcelSrc = map.getSource(SRC_PARCEL) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (parcelSrc) parcelSrc.setData(parcelFc);
      else {
        map.addSource(SRC_PARCEL, { type: "geojson", data: parcelFc });
        map.addLayer({
          id: LY_FILL,
          type: "fill",
          source: SRC_PARCEL,
          paint: {
            "fill-color": "#e8b089",
            "fill-opacity": 0.2,
          },
        });
        map.addLayer({
          id: LY_LINE,
          type: "line",
          source: SRC_PARCEL,
          paint: {
            "line-color": "#f0c9a0",
            "line-width": 3,
            "line-opacity": 1,
          },
        });
      }

      // Fit sheet: solid cream over aerial inside the lot + ink outline.
      const fillColor = paperMode
        ? "#faf6f2"
        : titleOnly
          ? "#f3c49a"
          : isLocked
            ? "#5ea884"
            : "#c9955a";
      const fillOp = paperMode ? 1 : titleOnly ? 0.28 : isLocked ? 0.1 : 0.12;
      const lineColor = paperMode
        ? "#241318"
        : titleOnly
          ? "#ffe0c2"
          : isLocked
            ? "#5ea884"
            : "#c9955a";
      const lineW = paperMode ? 2.5 : titleOnly ? 4.5 : 3;

      if (map.getLayer(LY_FILL)) {
        map.setPaintProperty(LY_FILL, "fill-color", fillColor);
        map.setPaintProperty(LY_FILL, "fill-opacity", fillOp);
      }
      if (map.getLayer(LY_LINE)) {
        map.setPaintProperty(LY_LINE, "line-color", lineColor);
        map.setPaintProperty(LY_LINE, "line-width", lineW);
      }

      const maskSrc = map.getSource(SRC_MASK) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (maskSrc) maskSrc.setData(maskFc);
      else {
        map.addSource(SRC_MASK, { type: "geojson", data: maskFc });
        map.addLayer(
          {
            id: LY_MASK,
            type: "fill",
            source: SRC_MASK,
            paint: {
              "fill-color": "#120c10",
              "fill-opacity": dim,
            },
          },
          LY_FILL,
        );
      }
      if (map.getLayer(LY_MASK)) {
        map.setPaintProperty(LY_MASK, "fill-color", paperMode ? "#FAF6F2" : "#120c10");
        map.setPaintProperty(LY_MASK, "fill-opacity", paperMode ? 1 : dim);
      }
    },
    [basemap, paperMode, titleOnly],
  );

  const clearMarkers = useCallback(() => {
    for (const m of markersRef.current) m.remove();
    for (const m of midMarkersRef.current) m.remove();
    markersRef.current = [];
    midMarkersRef.current = [];
  }, []);

  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (draggingRef.current) return;
    clearMarkers();
    const b = boundaryRef.current;
    if (!map || !b || b.vertices.length < 3) return;
    if (tool !== "edit" && tool !== "add") return;
    const isLocked = b.status === "VERIFIED";

    const sorted = b.vertices
      .slice()
      .sort((a, c) => a.sequence_index - c.sequence_index);

    for (const v of sorted) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `${css.vertex}${isLocked ? ` ${css.vertexLocked}` : ""}${
        selectedId === v.vertex_id ? ` ${css.vertexSelected}` : ""
      }`;
      el.title = isLocked ? "Locked vertex" : "Drag to snap";
      el.setAttribute("aria-label", "Boundary vertex");

      const marker = new maplibregl.Marker({
        element: el,
        draggable: !isLocked && tool === "edit",
      })
        .setLngLat([v.geo_coords.lng, v.geo_coords.lat])
        .addTo(map);

      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        setSelectedId(v.vertex_id);
      });

      if (!isLocked && tool === "edit") {
        marker.on("dragstart", () => {
          draggingRef.current = true;
        });
        marker.on("drag", () => {
          const live = boundaryRef.current;
          if (!live) return;
          const ll = marker.getLngLat();
          const canvas = geoToCanvasMetres(
            { lng: ll.lng, lat: ll.lat },
            live.geo_reference.canvas_origin_geo,
          );
          onBoundaryChange(
            fromDomain(
              moveBoundaryVertex(toDomain(live), v.vertex_id, canvas),
            ),
          );
        });
        marker.on("dragend", () => {
          draggingRef.current = false;
          syncMarkers();
        });
      }

      el.addEventListener("contextmenu", (e) => {
        const live = boundaryRef.current;
        if (!live || live.status === "VERIFIED") return;
        e.preventDefault();
        e.stopPropagation();
        try {
          onBoundaryChange(
            fromDomain(
              deleteBoundaryVertex(toDomain(live), v.vertex_id),
            ),
          );
          setSelectedId(null);
        } catch {
          /* min vertices */
        }
      });

      markersRef.current.push(marker);
    }

    if (!isLocked && (tool === "add" || tool === "edit")) {
      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i]!;
        const c = sorted[(i + 1) % sorted.length]!;
        const mid: [number, number] = [
          (a.geo_coords.lng + c.geo_coords.lng) / 2,
          (a.geo_coords.lat + c.geo_coords.lat) / 2,
        ];
        const el = document.createElement("button");
        el.type = "button";
        el.className = css.ghostMid;
        el.title = "Add vertex";
        el.setAttribute("aria-label", "Add boundary vertex");
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const live = boundaryRef.current;
          if (!live) return;
          const canvas = geoToCanvasMetres(
            { lng: mid[0], lat: mid[1] },
            live.geo_reference.canvas_origin_geo,
          );
          onBoundaryChange(
            fromDomain(
              insertBoundaryVertex(toDomain(live), a.vertex_id, canvas),
            ),
          );
        });
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(mid)
          .addTo(map);
        midMarkersRef.current.push(marker);
      }
    }
  }, [clearMarkers, onBoundaryChange, selectedId, tool]);

  // Init map once (MapLibre — no accessToken)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleSatellite,
      center: [center.lng, center.lat],
      zoom: 18,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      attributionControl: {},
      pitchWithRotate: false,
      dragRotate: false,
      renderWorldCopies: false,
    });
    map.scrollZoom.enable();
    map.scrollZoom.setWheelZoomRate(1 / 200);
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      "bottom-right",
    );
    mapRef.current = map;

    map.on("load", () => {
      syncLayers(map, parcelRing, locked);
      const ring =
        titleOnly && parcelRing.length >= 3
          ? parcelRing
          : focusRing.length >= 3
            ? focusRing
            : parcelRing;
      if (ring.length >= 3) fitToGarden(map, ring, { lockBounds: !titleOnly });
      setMapReady(true);
    });

    const onParcelClick = () => {
      if (!onTitleOpenRef.current) return;
      onTitleOpenRef.current();
    };
    map.on("click", LY_FILL, onParcelClick);
    map.on("click", LY_LINE, onParcelClick);
    map.on("mouseenter", LY_FILL, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LY_FILL, () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      map.off("click", LY_FILL, onParcelClick);
      map.off("click", LY_LINE, onParcelClick);
      clearMarkers();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Intentional once-on-mount; style fixed at create time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncHouseShadow = useCallback(
    (map: maplibregl.Map) => {
      // Title reveal: only the cadastral outline — no house/shadow clutter.
      if (titleOnly) {
        const empty: FeatureCollection = {
          type: "FeatureCollection",
          features: [],
        };
        const houseSrc = map.getSource(SRC_HOUSE) as
          | maplibregl.GeoJSONSource
          | undefined;
        const shadowSrc = map.getSource(SRC_SHADOW) as
          | maplibregl.GeoJSONSource
          | undefined;
        houseSrc?.setData(empty);
        shadowSrc?.setData(empty);
        return;
      }

      const houseOpen = openRing(houseRing);
      const houseClosed =
        houseOpen.length >= 3 ? closeRing(houseOpen) : null;
      const houseFc: FeatureCollection = {
        type: "FeatureCollection",
        features: houseClosed
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Polygon", coordinates: [houseClosed] },
              },
            ]
          : [],
      };
      const shadowClosed =
        shadowRing && shadowRing.length >= 4 ? shadowRing : null;
      const shadowFc: FeatureCollection = {
        type: "FeatureCollection",
        features: shadowClosed
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Polygon", coordinates: [shadowClosed] },
              },
            ]
          : [],
      };

      const ensure = (
        srcId: string,
        data: FeatureCollection,
        addLayers: () => void,
      ) => {
        const src = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(data);
        else {
          map.addSource(srcId, { type: "geojson", data });
          addLayers();
        }
      };

      ensure(SRC_SHADOW, shadowFc, () => {
        map.addLayer(
          {
            id: LY_SHADOW,
            type: "fill",
            source: SRC_SHADOW,
            paint: {
              "fill-color": "#1a1216",
              "fill-opacity": 0.38,
            },
          },
          LY_FILL,
        );
      });

      ensure(SRC_HOUSE, houseFc, () => {
        map.addLayer({
          id: LY_HOUSE_FILL,
          type: "fill",
          source: SRC_HOUSE,
          paint: {
            "fill-color": "#2a2226",
            "fill-opacity": 0.72,
          },
        });
        map.addLayer({
          id: LY_HOUSE_LINE,
          type: "line",
          source: SRC_HOUSE,
          paint: {
            "line-color": "#f7f0f3",
            "line-width": 1.25,
            "line-opacity": 0.9,
          },
        });
      });

      if (map.getLayer(LY_SHADOW)) {
        map.setPaintProperty(
          LY_SHADOW,
          "fill-color",
          paperMode ? "#241318" : "#1a1216",
        );
        map.setPaintProperty(
          LY_SHADOW,
          "fill-opacity",
          paperMode ? 0.08 : sunEnabled ? 0.38 : 0,
        );
      }
      if (map.getLayer(LY_HOUSE_FILL)) {
        map.setPaintProperty(
          LY_HOUSE_FILL,
          "fill-color",
          paperMode ? "#241318" : "#2a2226",
        );
        map.setPaintProperty(
          LY_HOUSE_FILL,
          "fill-opacity",
          paperMode ? 0.08 : 0.72,
        );
      }
      if (map.getLayer(LY_HOUSE_LINE)) {
        map.setPaintProperty(
          LY_HOUSE_LINE,
          "line-color",
          paperMode ? "#241318" : "#f7f0f3",
        );
        map.setPaintProperty(
          LY_HOUSE_LINE,
          "line-width",
          paperMode ? 1.6 : 1.25,
        );
      }
    },
    [houseRing, paperMode, shadowRing, sunEnabled, titleOnly],
  );

  // Sync parcel geojson when boundary / lot ring / lock changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const apply = () => {
      syncLayers(map, parcelRing, locked);
      syncHouseShadow(map);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [parcelRing, locked, mapReady, syncLayers, syncHouseShadow]);

  // Sun scrubber updates shadow without full parcel rebuild
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;
    syncHouseShadow(map);
  }, [mapReady, syncHouseShadow, sunMinutes, sunEnabled]);

  // Markers — rebuild on topology/tool, not every drag coordinate tick
  useEffect(() => {
    if (!mapReady || titleOnly) {
      clearMarkers();
      return;
    }
    syncMarkers();
  }, [mapReady, syncMarkers, vertexKey, locked, tool, titleOnly, clearMarkers]);

  // Fit: title phase → whole Vicmap outline; design → garden focus
  const focusReady = focusRing.length >= 3 || parcelRing.length >= 3;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusReady) return;
    const ring =
      titleOnly && parcelRing.length >= 3
        ? parcelRing
        : focusRing.length >= 3
          ? focusRing
          : parcelRing;
    fitToGarden(map, ring, { lockBounds: !titleOnly });
  }, [fitNonce, fitToGarden, mapReady, focusReady, titleOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Basemap style swap only
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const next = basemap === "satellite" ? styleSatellite : styleStreets;
    map.setStyle(next);
    map.once("style.load", () => {
      syncLayers(map, parcelRing, locked);
      syncHouseShadow(map);
      syncMarkers();
    });
    // parcelRing/locked read at style.load time — avoid re-setStyle on edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, mapReady, styleSatellite, styleStreets]);

  // Interactive map drag vs boundary tools / sketch brush / line draw
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const panOk = allowMapPan && tool === "pan" && !lineDrawActive;
    if (panOk) {
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
    } else {
      map.dragPan.disable();
      map.getCanvas().style.cursor = lineDrawActive
        ? "crosshair"
        : tool === "edit"
          ? "crosshair"
          : tool === "add"
            ? "copy"
            : "default";
    }
  }, [tool, mapReady, allowMapPan, lineDrawActive]);

  /** Lot-metre sheet frame (SW origin, Y-up) matching CAD / placeOnParcelFrame. */
  const sheetFrame = useCallback(() => {
    const open = openRing(parcelRing);
    let origin = boundary?.geo_reference.canvas_origin_geo ?? null;
    let widthM = cadWidthM ?? boundary?.width_m ?? 0;
    let heightM = cadHeightM ?? boundary?.height_m ?? 0;
    if ((!origin || widthM <= 0 || heightM <= 0) && open.length >= 3) {
      let minLng = Infinity;
      let minLat = Infinity;
      let maxLng = -Infinity;
      let maxLat = -Infinity;
      for (const [lng, lat] of open) {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      }
      const pad = 2;
      const mPerLng = 110_540 * Math.cos((minLat * Math.PI) / 180);
      origin = {
        lng: minLng - pad / mPerLng,
        lat: minLat - pad / 110_540,
      };
      widthM = Math.max(1, (maxLng - minLng) * mPerLng) + pad * 2;
      heightM = Math.max(1, (maxLat - minLat) * 110_540) + pad * 2;
    }
    if (!origin || widthM <= 0 || heightM <= 0) return null;
    return { origin, widthM, heightM };
  }, [boundary, cadHeightM, cadWidthM, parcelRing]);

  // CAD line draw — click vertices, double-click / Enter to commit, Esc cancel
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const ensureDrawLayers = () => {
      if (!map.getSource(SRC_DRAW)) {
        map.addSource(SRC_DRAW, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer(LY_DRAW_LINE)) {
        map.addLayer({
          id: LY_DRAW_LINE,
          type: "line",
          source: SRC_DRAW,
          filter: ["==", ["geometry-type"], "LineString"],
          paint: {
            "line-color": paperMode ? "#241318" : "#f4e8ee",
            "line-width": 2.5,
            "line-opacity": 0.95,
          },
        });
      } else {
        map.setPaintProperty(
          LY_DRAW_LINE,
          "line-color",
          paperMode ? "#241318" : "#f4e8ee",
        );
      }
      if (!map.getLayer(LY_DRAW_PTS)) {
        map.addLayer({
          id: LY_DRAW_PTS,
          type: "circle",
          source: SRC_DRAW,
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 4.5,
            "circle-color": paperMode ? "#241318" : "#fffafc",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": paperMode ? "#faf6f2" : "#24181e",
          },
        });
      } else {
        map.setPaintProperty(
          LY_DRAW_PTS,
          "circle-color",
          paperMode ? "#241318" : "#fffafc",
        );
      }
    };

    let cursor: [number, number] | null = null;

    const paintDraft = (pts: [number, number][], hover?: [number, number] | null) => {
      ensureDrawLayers();
      const src = map.getSource(SRC_DRAW) as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      const features: Array<{
        type: "Feature";
        properties: Record<string, unknown>;
        geometry:
          | { type: "Point"; coordinates: [number, number] }
          | { type: "LineString"; coordinates: [number, number][] };
      }> = pts.map((c) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: c },
      }));
      if (pts.length >= 2) {
        features.push({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: pts },
        });
      }
      // Rubber-band from last vertex to cursor
      if (pts.length >= 1 && hover) {
        features.push({
          type: "Feature",
          properties: { preview: true },
          geometry: {
            type: "LineString",
            coordinates: [pts[pts.length - 1]!, hover],
          },
        });
      }
      src.setData({ type: "FeatureCollection", features });
    };

    if (!lineDrawActive || titleOnly) {
      setDraftPts([]);
      cursor = null;
      if (map.getSource(SRC_DRAW)) {
        (map.getSource(SRC_DRAW) as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: [],
        });
      }
      map.getCanvas().style.cursor = "";
      return;
    }

    ensureDrawLayers();
    paintDraft(draftPtsRef.current, cursor);
    map.getCanvas().style.cursor = "crosshair";

    const commit = () => {
      const pts = draftPtsRef.current;
      if (pts.length < 2) return;
      const frame = sheetFrame();
      if (!frame) return;
      const metres = pts.map(([lng, lat]) =>
        geoToCanvasMetres({ lng, lat }, frame.origin),
      );
      onLineCommitRef.current?.(metres);
      setDraftPts([]);
      cursor = null;
      paintDraft([]);
    };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const next: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setDraftPts((prev) => {
        const merged = [...prev, next];
        paintDraft(merged, cursor);
        return merged;
      });
    };

    const onMove = (e: maplibregl.MapMouseEvent) => {
      cursor = [e.lngLat.lng, e.lngLat.lat];
      paintDraft(draftPtsRef.current, cursor);
    };

    const onDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      commit();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        setDraftPts([]);
        cursor = null;
        paintDraft([]);
      }
    };

    map.on("click", onClick);
    map.on("mousemove", onMove);
    map.on("dblclick", onDblClick);
    window.addEventListener("keydown", onKey);
    map.doubleClickZoom.disable();

    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMove);
      map.off("dblclick", onDblClick);
      window.removeEventListener("keydown", onKey);
      map.doubleClickZoom.enable();
      map.getCanvas().style.cursor = "";
    };
  }, [lineDrawActive, mapReady, paperMode, sheetFrame, titleOnly]);

  /**
   * Title design sheet: lot-metre frame (SW origin, Y-up) projected onto the map,
   * clipped to the Vicmap ring so sketch/CAD live on the title — not a second box.
   */
  const placeOnParcelFrame = useCallback(
    (
      map: maplibregl.Map,
      el: HTMLElement,
      opts?: { hideIfEmpty?: boolean; clipToParcel?: boolean },
    ) => {
      const open = openRing(parcelRing);
      if (open.length < 3) {
        if (opts?.hideIfEmpty !== false) el.style.display = "none";
        return;
      }

      const b = boundaryRef.current;
      let origin = b?.geo_reference.canvas_origin_geo ?? null;
      let widthM = cadWidthM ?? b?.width_m ?? 0;
      let heightM = cadHeightM ?? b?.height_m ?? 0;

      if (!origin || widthM <= 0 || heightM <= 0) {
        let minLng = Infinity;
        let minLat = Infinity;
        let maxLng = -Infinity;
        let maxLat = -Infinity;
        for (const [lng, lat] of open) {
          minLng = Math.min(minLng, lng);
          minLat = Math.min(minLat, lat);
          maxLng = Math.max(maxLng, lng);
          maxLat = Math.max(maxLat, lat);
        }
        const pad = 2;
        const mPerLng =
          110_540 * Math.cos((minLat * Math.PI) / 180);
        origin = {
          lng: minLng - pad / mPerLng,
          lat: minLat - pad / 110_540,
        };
        widthM = Math.max(1, (maxLng - minLng) * mPerLng) + pad * 2;
        heightM = Math.max(1, (maxLat - minLat) * 110_540) + pad * 2;
      }

      const sw = canvasMetresToGeo({ x: 0, y: 0 }, origin);
      const se = canvasMetresToGeo({ x: widthM, y: 0 }, origin);
      const nw = canvasMetresToGeo({ x: 0, y: heightM }, origin);
      const pSW = map.project([sw.lng, sw.lat]);
      const pSE = map.project([se.lng, se.lat]);
      const pNW = map.project([nw.lng, nw.lat]);
      const w = Math.max(Math.hypot(pSE.x - pSW.x, pSE.y - pSW.y), 8);
      const h = Math.max(Math.hypot(pNW.x - pSW.x, pNW.y - pSW.y), 8);
      const angle = Math.atan2(pSE.y - pSW.y, pSE.x - pSW.x);

      el.style.display = "block";
      el.style.left = `${pSW.x}px`;
      el.style.top = `${pSW.y}px`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.transform = `translate(0, ${-h}px) rotate(${angle}rad)`;
      el.style.transformOrigin = "0 100%";
      if (opts?.clipToParcel === false) {
        el.style.clipPath = "none";
      } else {
        const clip = open
          .map(([lng, lat]) => {
            const c = geoToCanvasMetres({ lng, lat }, origin!);
            const lx = (c.x / widthM) * w;
            const ly = ((heightM - c.y) / heightM) * h;
            return `${lx.toFixed(2)}px ${ly.toFixed(2)}px`;
          })
          .join(", ");
        el.style.clipPath = `polygon(${clip})`;
      }
      el.dataset.sheetW = String(widthM);
      el.dataset.sheetH = String(heightM);
    },
    [cadHeightM, cadWidthM, parcelRing],
  );

  // Project design frame + CAD onto title parcel
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const place = () => {
      const design = designRef.current;
      if (design) {
        if (!titleOnly && designOverlay) placeOnParcelFrame(map, design);
        else design.style.display = "none";
      }
      const cad = cadRef.current;
      if (cad) {
        if (!titleOnly && cadSvg) placeOnParcelFrame(map, cad);
        else cad.style.display = "none";
      }
      const sheet = fitSheetRef.current;
      if (sheet) {
        // Paper mode: metre grid + registration on the lot (title block is ArchitecturalSheet).
        if (!titleOnly && paperMode && fitSheetMeta) {
          placeOnParcelFrame(map, sheet, { clipToParcel: false });
        } else {
          sheet.style.display = "none";
        }
      }
    };

    place();
    map.on("move", place);
    map.on("resize", place);
    return () => {
      map.off("move", place);
      map.off("resize", place);
    };
  }, [
    cadSvg,
    designOverlay,
    fitSheetMeta,
    mapReady,
    placeOnParcelFrame,
    paperMode,
    titleOnly,
    boundary?.id,
    boundary?.width_m,
    boundary?.height_m,
    cadWidthM,
    cadHeightM,
  ]);

  const fitSheetSize = useMemo(() => {
    const frame = sheetFrame();
    if (!frame) {
      return {
        widthM: cadWidthM ?? boundary?.width_m ?? 20,
        heightM: cadHeightM ?? boundary?.height_m ?? 16,
      };
    }
    return { widthM: frame.widthM, heightM: frame.heightM };
  }, [boundary?.height_m, boundary?.width_m, cadHeightM, cadWidthM, sheetFrame]);

  const fitSheetEdges = useMemo((): FitSheetEdge[] => {
    const frame = sheetFrame();
    const open = openRing(parcelRing);
    if (!frame || open.length < 3) return [];
    const pts = open.map(([lng, lat]) =>
      geoToCanvasMetres({ lng, lat }, frame.origin),
    );
    const edges: FitSheetEdge[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 0.8) continue;
      edges.push({
        x1: a.x,
        y1: frame.heightM - a.y,
        x2: b.x,
        y2: frame.heightM - b.y,
        label: `${len.toFixed(len >= 10 ? 1 : 2)} m`,
      });
    }
    return edges.slice(0, 12);
  }, [parcelRing, sheetFrame]);

  const sourceLabel = boundary
    ? boundary.source_kind === "vicmap"
      ? "Vicmap Property · Land Vic"
      : boundary.source_kind
    : lotRing.length >= 3
      ? "Vicmap survey ring"
      : "No parcel yet";

  const sunControls = (
    <div
      className={sheetMode ? css.sunDockSheet : css.sunDock}
      data-testid="sun-cast-dock"
    >
      <div className={css.sunHeader}>
        <button
          type="button"
          className={`${css.sunToggle}${sunEnabled ? ` ${css.sunToggleOn}` : ""}`}
          onClick={() => setSunEnabled((v) => !v)}
          aria-pressed={sunEnabled}
        >
          Sun cast
        </button>
        <span className={css.sunClock}>
          {sunEnabled
            ? sunInfo.up
              ? formatSunClock(sunDate)
              : "Below horizon"
            : "Off"}
        </span>
      </div>
      {sunEnabled ? (
        <>
          <input
            type="range"
            className={css.sunSlider}
            min={dayBounds.sunriseMin}
            max={dayBounds.sunsetMin}
            step={5}
            value={sunMinutesClamped}
            onChange={(e) => setSunMinutes(Number(e.target.value))}
            aria-label="Time of day for sun cast"
          />
          <p className={css.sunHint}>
            {houseRing.length >= 3
              ? sunInfo.up
                ? `Building shadow · ${buildingHeightM.toFixed(0)} m eaves`
                : "Scrub toward noon for shade"
              : "Building footprint loads with survey"}
          </p>
        </>
      ) : null}
    </div>
  );

  return (
    <div
      className={`${css.mapRoot}${sheetMode ? ` ${css.mapRootSheet}` : ""}${
        titleOnly ? ` ${css.mapRootTitle}` : ""
      }${paperMode ? ` ${css.mapRootPaper}` : ""}${
        className ? ` ${className}` : ""
      }`}
      data-testid="geo-site-map"
      data-sheet-mode={sheetMode ? "1" : undefined}
      data-paper-mode={paperMode ? "1" : undefined}
      data-phase={phase}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <div
        ref={designRef}
        className={`${css.designFrame}${paperMode ? ` ${css.designFramePaper}` : ""}`}
        style={{ display: "none" }}
        data-testid="geo-design-frame"
      >
        {designOverlay}
      </div>
      <div
        ref={cadRef}
        className={`${css.cadOverlay}${paperMode ? ` ${css.cadOverlayPaper}` : ""}`}
        style={{ display: "none" }}
        dangerouslySetInnerHTML={cadSvg ? { __html: cadSvg } : undefined}
        aria-hidden
      />
      <div
        ref={fitSheetRef}
        className={css.fitSheetOverlay}
        style={{ display: "none" }}
        aria-hidden
      >
        {paperMode && fitSheetMeta ? (
          <FitSheetLayer
            widthM={fitSheetSize.widthM}
            heightM={fitSheetSize.heightM}
            meta={fitSheetMeta}
            edges={fitSheetEdges}
            paper
            showDims={fitSheetShowDims}
            visible
          />
        ) : null}
      </div>
      {titleOnly ? (
        <button
          type="button"
          className={css.titleReveal}
          data-testid="title-reveal"
          onClick={() => onTitleOpenRef.current?.()}
        >
          <strong>Title</strong>
          <span>Open Fit sheet — cream working drawing + line CAD</span>
        </button>
      ) : (
        <>
          {!paperMode ? (
            <div className={css.basemapToggle} role="group" aria-label="Basemap">
              <button
                type="button"
                className={`${css.basemapBtn}${
                  basemap === "satellite" ? ` ${css.basemapBtnActive}` : ""
                }`}
                onClick={() => setBasemap("satellite")}
              >
                Aerial
              </button>
              <button
                type="button"
                className={`${css.basemapBtn}${
                  basemap === "streets" ? ` ${css.basemapBtnActive}` : ""
                }`}
                title="Context only — OSM lots are not Vicmap title"
                onClick={() => setBasemap("streets")}
              >
                Streets
              </button>
            </div>
          ) : null}
          {!sheetMode && !paperMode ? (
            <div className={css.parcelBadge}>
              <strong>
                {locked ? "Title canvas locked" : "Title canvas"}
              </strong>
              {sourceLabel}
              {boundary ? (
                <>
                  {" · "}
                  {boundary.calculated_metrics.total_area_m2.toLocaleString()}{" "}
                  m²
                </>
              ) : null}
              <span className={css.parcelNote}>
                Design the garden · house is not the canvas
              </span>
            </div>
          ) : null}
          {!sheetMode && !paperMode ? sunControls : null}
          {sheetMode && !paperMode ? (
            <div className={css.sheetToolStrip}>{sunControls}</div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function GeoSiteMapFallback({ address }: { address: string }) {
  return (
    <div className={css.fallback} data-testid="geo-site-map-fallback">
      <div>
        <strong>Geo canvas unavailable</strong>
        Mapbox token missing for {address}. Trace still works once survey
        lands a Vicmap ring — add a pk.* MAPBOX_TOKEN to enable the live map.
      </div>
    </div>
  );
}
