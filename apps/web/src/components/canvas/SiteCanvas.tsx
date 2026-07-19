"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  Suspense,
} from "react";
import type { CatalogSymbol } from "@workstream/contracts";
import type { ProjectOrchestrationWorld } from "@workstream/contracts";
import {
  buildBoundaryFromGeoRing,
  computeSiteCompliance,
  isTier1WrightsTerrace,
} from "@workstream/domain";
import {
  acceptCadAction,
  applyCadOpsAction,
  autoTraceBoundaryAction,
  cadBuildAction,
  cadQuantitySurveyAction,
  cadQuoteAction,
  copyPortalLinkAction,
  downloadCadDxfAction,
  editCadAction,
  ensureCadAction,
  generateCadAction,
  lockBoundaryAction,
  resetBoundaryAction,
  runSurveyAction,
  saveBoundaryAction,
  unlockBoundaryAction,
} from "../../app/actions";
import {
  createCanvasHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type CanvasHistory,
} from "../../lib/canvas-history";
import { FirstRunGuide } from "./FirstRunGuide";
import { LiveBomHud } from "./LiveBomHud";
import { ComplianceDock } from "./ComplianceDock";
import { CanvasToolRail, type CanvasTool } from "./CanvasToolRail";
import { ElevationProfile } from "./ElevationProfile";
import { GhostReviewCard } from "./GhostReviewCard";
import { CanvasCoachMarks } from "./CanvasCoachMarks";
import { CanvasStudioCommandPalette } from "./CanvasStudioCommandPalette";
import { SheetElevationPanel } from "./SheetElevationPanel";
import { SunShadeControls } from "./SunShadeControls";
import { SiteIntelligenceOverlay } from "./SiteIntelligenceOverlay";
import type {
  CadBuildApi,
  CadDocumentLite,
  CadQuantitySurveyApi,
  SiteBoundaryLite,
} from "../../lib/canvas-types";
import type { DesignCanvas, RateCardItem } from "../../lib/api";
import { resolveCanvasChrome } from "../../lib/canvas-chrome";
import {
  resolveCanvasMode,
  type CanvasMode,
} from "../../lib/canvas-mode";
import { onOrchestrationRefreshRequest } from "../../lib/canvas-mutation-bus";
import { fetchMapConfig, type MapConfig } from "../../lib/map-config";
import {
  displaySizeForAerial,
  fitWorldToStage,
  groundSpanMetres,
  resolveStaticMapView,
} from "../../lib/mapView";
import {
  BoundaryChrome,
  BoundaryOverlay,
  type BoundaryTool,
} from "./BoundaryLockSnap";
import { CanvasStudioHeader, type PaperSize } from "./CanvasStudioHeader";
import { SketchInstrument } from "./SketchInstrument";
import {
  DraftingHud,
  MeasureOverlay,
  measureDistanceMetres,
  type MeasurePt,
} from "./DraftingAssist";
import { TitleParcelOverlay } from "./TitleParcelOverlay";
import { ArchitecturalSheet } from "./ArchitecturalSheet";
import { fitSheetScaleLabel } from "./FitSheetLayer";
import { GeoSiteMapFallback } from "./GeoSiteMap";
import type {
  ClayPlant,
  ClayPolyline,
  ClayRing,
} from "./ClayWalkthrough";
import { SheetAnchorsOverlay } from "./SheetAnchorsOverlay";
import { Tier1SavingsLedger } from "../tier1";
import {
  DEFAULT_CANVAS_VIEW_LAYERS,
  type CanvasViewLayers,
} from "../../lib/canvas-view-layers";
import {
  applyBucketOpacity,
  DEFAULT_LAYER_OPACITY,
  SURVEY_LAYER_PRESET,
  type CanvasLayerOpacity,
} from "../../lib/canvas-layer-opacity";
import css from "./siteCanvas.module.css";

type SketchCommandsApi = {
  scanGhosts: () => void;
  openCommands: () => void;
};

const GeoSiteMap = dynamic(
  () => import("./GeoSiteMap").then((m) => m.GeoSiteMap),
  { ssr: false },
);

const ClayWalkthrough = dynamic(
  () => import("./ClayWalkthrough").then((m) => m.ClayWalkthrough),
  { ssr: false },
);

function buildClayScene(
  boundary: SiteBoundaryLite | null,
  cadDoc: CadDocumentLite | null,
): { rings: ClayRing[]; polylines: ClayPolyline[]; plants: ClayPlant[] } {
  const rings: ClayRing[] = [];
  const polylines: ClayPolyline[] = [];
  const plants: ClayPlant[] = [];

  if (boundary && boundary.vertices.length >= 3) {
    const lot = boundary.vertices
      .slice()
      .sort((a, b) => a.sequence_index - b.sequence_index)
      .map(
        (v) =>
          [v.canvas_coords.x, v.canvas_coords.y] as [number, number],
      );
    rings.push({ points: lot, height: 0.12 });
  } else if (cadDoc && cadDoc.width_m > 0 && cadDoc.height_m > 0) {
    rings.push({
      points: [
        [0, 0],
        [cadDoc.width_m, 0],
        [cadDoc.width_m, cadDoc.height_m],
        [0, cadDoc.height_m],
      ],
      height: 0.12,
    });
  }

  for (const e of cadDoc?.entities ?? []) {
    if (e.ghost || e.verification_state === "UNVERIFIED") continue;
    const layer = (e.layer ?? "").toUpperCase();
    if (e.kind === "polyline" && e.points && e.points.length >= 2) {
      const pts = e.points.map(
        (p) => [p.x, p.y] as [number, number],
      );
      if (e.closed && pts.length >= 3) {
        const height = /STRUCT|RETAIN|WALL/.test(layer)
          ? 1.8
          : /HARDSCAPE|PAVE|DECK/.test(layer)
            ? 0.18
            : 0.4;
        rings.push({ points: pts, height });
      } else {
        polylines.push({
          points: pts,
          height: /FENCE|RETAIN|STRUCT/.test(layer) ? 1.25 : 0.95,
        });
      }
      continue;
    }
    if (e.kind === "line" && e.start && e.end) {
      polylines.push({
        points: [
          [e.start.x, e.start.y],
          [e.end.x, e.end.y],
        ],
        height: /FENCE|RETAIN|STRUCT/.test(layer) ? 1.25 : 0.95,
      });
      continue;
    }
    if (
      (e.kind === "insert" || e.kind === "circle") &&
      (/PLANT/.test(layer) || e.kind === "insert")
    ) {
      const pos = e.position ?? e.center;
      if (pos) {
        plants.push({
          x: pos.x,
          y: pos.y,
          scale: /TREE/.test(e.block_name ?? layer) ? 1.4 : 1,
        });
      }
    }
  }

  return { rings, polylines, plants };
}

export type SketchBundle = {
  aerialUri: string;
  lotRing: [number, number][];
  /** Vicmap building footprint when survey found one. */
  houseRing?: [number, number][];
  symbols: CatalogSymbol[];
  rateCard: RateCardItem[];
  canvas: DesignCanvas | null;
  surveyMetrics?: {
    garden_area_m2: number;
    lot_area_m2: number;
    house_area_m2: number;
    lat?: number | null;
    lng?: number | null;
  };
};

type Props = {
  projectId: string;
  projectAddress: string;
  aerialUri: string | null;
  initialDocument: CadDocumentLite | null;
  initialSvg: string | null;
  initialGhostCount: number;
  initialBoundary: SiteBoundaryLite | null;
  sketch?: SketchBundle | null;
  quoteUrl?: string | null;
  hasQuote?: boolean;
};

type Sheet = "none" | "qs" | "build";

function SiteCanvasInner({
  projectId,
  projectAddress,
  aerialUri,
  initialDocument,
  initialSvg,
  initialGhostCount,
  initialBoundary,
  sketch = null,
  quoteUrl = null,
  hasQuote = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cadDoc, setCadDoc] = useState<CadDocumentLite | null>(initialDocument);
  const [svg, setSvg] = useState(initialSvg);
  const [ghostCount, setGhostCount] = useState(initialGhostCount);
  const [boundary, setBoundary] = useState<SiteBoundaryLite | null>(
    initialBoundary,
  );
  const [boundaryTool, setBoundaryTool] = useState<BoundaryTool>("pan");
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<CadQuantitySurveyApi | null>(null);
  const [build, setBuild] = useState<CadBuildApi | null>(null);
  const [quoteHtml, setQuoteHtml] = useState<string | null>(null);
  const [showQuoteOverlay, setShowQuoteOverlay] = useState(false);
  const [sheet, setSheet] = useState<Sheet>("none");
  const [portalLink, setPortalLink] = useState<string | null>(quoteUrl);
  const [quotePersisted, setQuotePersisted] = useState(hasQuote);
  const [showCadAdvanced, setShowCadAdvanced] = useState(false);
  /** Keep title canvas readable — quote ledger collapsed until asked. */
  const [quoteToolsOpen, setQuoteToolsOpen] = useState(false);
  /**
   * Progressive disclosure: tinted world + Vicmap title only, until the
   * outline is clicked — then the garden CAD sheet opens ready to design.
   */
  const [titleOpened, setTitleOpened] = useState(() => {
    const hasWork =
      Boolean(hasQuote) ||
      (sketch?.canvas?.placements?.length ?? 0) > 0 ||
      (initialDocument?.entities.some(
        (e) => !e.ghost && e.verification_state !== "UNVERIFIED",
      ) ?? false);
    if (hasWork) return true;
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(`ws-title-open:${projectId}`) === "1";
    } catch {
      return false;
    }
  });
  const [orchRefresh, setOrchRefresh] = useState(0);
  const [orchWorld, setOrchWorld] = useState<ProjectOrchestrationWorld | null>(
    null,
  );
  const [showGuide, setShowGuide] = useState(
    () => searchParams.get("guide") === "1",
  );
  const [sketchCount, setSketchCount] = useState(
    () => sketch?.canvas?.placements?.length ?? 0,
  );
  const [pending, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tier1 = isTier1WrightsTerrace(projectAddress);

  const committedCount =
    cadDoc?.entities.filter(
      (e) => !e.ghost && e.verification_state !== "UNVERIFIED",
    ).length ?? 0;
  const progress = {
    hasAerial: Boolean(aerialUri),
    hasSketch:
      sketchCount > 0 || (sketch?.canvas?.placements?.length ?? 0) > 0,
    /** Accepted CAD only — ghosts must be cleared (matches API quote gate). */
    hasCad: committedCount > 0 && ghostCount === 0,
    /** Persisted output only — local HTML preview does not unlock Share. */
    hasQuote: quotePersisted,
  };
  const mode = resolveCanvasMode(searchParams.get("mode"), progress);

  useEffect(() => {
    setQuotePersisted(hasQuote);
  }, [hasQuote]);

  useEffect(() => {
    setPortalLink(quoteUrl);
  }, [quoteUrl]);

  const setMode = useCallback(
    (next: CanvasMode) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("mode", next);
      router.replace(`/projects/${projectId}?${params.toString()}`, {
        scroll: false,
      });
    },
    [projectId, router, searchParams],
  );

  // Keep URL honest when progressive unlock clamps the mode.
  useEffect(() => {
    const raw = searchParams.get("mode");
    if (raw !== mode) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("mode", mode);
      router.replace(`/projects/${projectId}?${params.toString()}`, {
        scroll: false,
      });
    }
  }, [mode, projectId, router, searchParams]);

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(40);
  const [ty, setTy] = useState(80);
  const [worldSize, setWorldSize] = useState({ width: 800, height: 480 });
  const [measureActive, setMeasureActive] = useState(false);
  const [measurePts, setMeasurePts] = useState<MeasurePt[]>([]);
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  /** Progressive disclosure — clay Walk overlay on CAD / quote / share. */
  const [walkMode, setWalkMode] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);
  const [sketchArmed, setSketchArmed] = useState(false);
  /** Progressive disclosure — material ribbon after Paint. */
  const [sketchPaintOpen, setSketchPaintOpen] = useState(false);
  const [cadDrawArmed, setCadDrawArmed] = useState(() => {
    const committed =
      initialDocument?.entities.filter(
        (e) => !e.ghost && e.verification_state !== "UNVERIFIED",
      ).length ?? 0;
    return committed > 0 && initialGhostCount === 0;
  });
  /** Paper working drawing — on by default for CAD / quote / share. */
  const [showFitSheet, setShowFitSheet] = useState(() => {
    try {
      const v = sessionStorage.getItem(`ws-fit-sheet:${projectId}`);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch {
      /* ignore */
    }
    return true;
  });
  /** Parcel edge dimensions on Fit sheet chrome. */
  const [showFitDims, setShowFitDims] = useState(() => {
    try {
      const v = sessionStorage.getItem(`ws-fit-dims:${projectId}`);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch {
      /* ignore */
    }
    return true;
  });
  /** Stack of entity ids for Cmd/Ctrl+Z undo of drawn lines. */
  const [cadUndoIds, setCadUndoIds] = useState<string[]>([]);
  const boundaryHistoryRef = useRef<CanvasHistory<SiteBoundaryLite | null>>(
    createCanvasHistory(),
  );
  const [keysHelpOn, setKeysHelpOn] = useState(false);
  const [viewLayers, setViewLayers] = useState<CanvasViewLayers>(
    DEFAULT_CANVAS_VIEW_LAYERS,
  );
  const [layerOpacity, setLayerOpacity] =
    useState<CanvasLayerOpacity>(DEFAULT_LAYER_OPACITY);
  const layerOpacityRestore = useRef<CanvasLayerOpacity>(DEFAULT_LAYER_OPACITY);
  const [focusChrome, setFocusChrome] = useState(false);
  const [darkCanvas, setDarkCanvas] = useState(false);
  const [clientView, setClientView] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>("A3");
  const [sheetElevations, setSheetElevations] = useState(false);
  const [complianceCollapsed, setComplianceCollapsed] = useState(false);
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("pan");
  const [globalCommandOpen, setGlobalCommandOpen] = useState(false);
  const [selectedElevationId, setSelectedElevationId] = useState<string | null>(
    null,
  );
  const [ghostReviewIndex, setGhostReviewIndex] = useState(0);
  const [autosaveLabel, setAutosaveLabel] = useState<string | null>(null);
  const [sunWhen, setSunWhen] = useState(() => new Date());
  const sketchCommandsRef = useRef<SketchCommandsApi | null>(null);
  const cadDocRef = useRef(cadDoc);
  cadDocRef.current = cadDoc;
  const [sketchChromeHost, setSketchChromeHost] =
    useState<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const autoTraceOnce = useRef(false);
  const drag = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
  } | null>(null);

  const activeAerial = aerialUri ?? sketch?.aerialUri ?? null;
  const lotRing = sketch?.lotRing ?? [];
  const mapView = useMemo(() => {
    if (!activeAerial && lotRing.length < 3) return null;
    return resolveStaticMapView(activeAerial ?? "", lotRing);
  }, [activeAerial, lotRing]);
  const groundSpan = mapView ? groundSpanMetres(mapView) : null;

  useEffect(() => {
    let cancelled = false;
    void fetchMapConfig().then((cfg) => {
      if (!cancelled) setMapConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fallbackCenter = useMemo(() => {
    const lat = sketch?.surveyMetrics?.lat;
    const lng = sketch?.surveyMetrics?.lng;
    if (lat != null && lng != null) return { lat, lng };
    if (mapView) return { lat: mapView.lat, lng: mapView.lng };
    if (boundary?.vertices[0]) {
      return {
        lat: boundary.vertices[0].geo_coords.lat,
        lng: boundary.vertices[0].geo_coords.lng,
      };
    }
    return null;
  }, [boundary, mapView, sketch?.surveyMetrics?.lat, sketch?.surveyMetrics?.lng]);

  const hasParcelGeo =
    (boundary?.vertices.length ?? 0) >= 3 || lotRing.length >= 3;
  /** Live MapLibre stage for Survey → Sketch → CAD → Quote → Share. */
  const useGeoStage =
    Boolean(mapConfig) && (hasParcelGeo || Boolean(fallbackCenter));
  /** World blacked out — only the Vicmap title outline until opened. */
  const titleRevealActive = useGeoStage && hasParcelGeo && !titleOpened;
  const chrome = resolveCanvasChrome({
    mode,
    titleRevealActive,
    hasSketchBundle: Boolean(sketch),
    cadDrawArmed,
  });
  const canWalk = chrome.walk;
  const clayScene = useMemo(
    () => buildClayScene(boundary, cadDoc),
    [boundary, cadDoc],
  );

  const openTitleDrawing = useCallback(() => {
    setTitleOpened(true);
    setShowFitSheet(true);
    // Blank sheet keeps Draft CTA; Line arms when geometry already exists.
    setCadDrawArmed(committedCount > 0 && ghostCount === 0);
    setMode("cad");
    setFitNonce((n) => n + 1);
    try {
      sessionStorage.setItem(`ws-title-open:${projectId}`, "1");
    } catch {
      /* ignore */
    }
  }, [committedCount, ghostCount, projectId, setMode]);

  // First entry into CAD / Quote / Share without a stored pref → Fit sheet on.
  const fitSheetPrefRef = useRef(false);
  useEffect(() => {
    try {
      fitSheetPrefRef.current =
        sessionStorage.getItem(`ws-fit-sheet:${projectId}`) != null;
    } catch {
      fitSheetPrefRef.current = false;
    }
  }, [projectId]);

  useEffect(() => {
    if (
      !fitSheetPrefRef.current &&
      (mode === "cad" || mode === "quote" || mode === "share")
    ) {
      setShowFitSheet(true);
    }
  }, [mode]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        `ws-fit-sheet:${projectId}`,
        showFitSheet ? "1" : "0",
      );
      fitSheetPrefRef.current = true;
    } catch {
      /* ignore */
    }
  }, [projectId, showFitSheet]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        `ws-fit-dims:${projectId}`,
        showFitDims ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [projectId, showFitDims]);

  /** Ensure Vicmap ring becomes an editable SiteBoundary so design can start. */
  useEffect(() => {
    if (autoTraceOnce.current) return;
    if (boundary) return;
    if (!aerialUri && lotRing.length < 3) return;
    autoTraceOnce.current = true;
    startTransition(async () => {
      try {
        const res = await autoTraceBoundaryAction(projectId);
        setBoundary(res.boundary);
        setFitNonce((n) => n + 1);
      } catch {
        autoTraceOnce.current = false;
      }
    });
  }, [aerialUri, boundary, lotRing.length, projectId]);

  const applyFit = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const next = fitWorldToStage(
      rect.width,
      rect.height,
      worldSize.width,
      worldSize.height,
    );
    setScale(next.scale);
    setTx(next.tx);
    setTy(next.ty);
  }, [worldSize.height, worldSize.width]);

  const onAerialLoad = useCallback(
    (img: HTMLImageElement) => {
      const naturalW = img.naturalWidth || mapView?.width || 800;
      const naturalH = img.naturalHeight || mapView?.height || 480;
      const size = displaySizeForAerial(naturalW, naturalH);
      setWorldSize(size);
      requestAnimationFrame(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        const next = fitWorldToStage(
          rect.width,
          rect.height,
          size.width,
          size.height,
        );
        setScale(next.scale);
        setTx(next.tx);
        setTy(next.ty);
      });
    },
    [mapView?.height, mapView?.width],
  );

  useEffect(() => {
    if (!activeAerial && mapView) {
      const size = displaySizeForAerial(mapView.width, mapView.height);
      setWorldSize(size);
    }
  }, [activeAerial, mapView]);

  const applyCad = useCallback(
    (result: {
      document: CadDocumentLite | null;
      svg: string | null;
      ghost_count: number;
    }) => {
      const prev = new Set(
        (cadDocRef.current?.entities ?? []).map((e) => e.id),
      );
      const added =
        result.document?.entities
          .map((e) => e.id)
          .filter((id) => !prev.has(id)) ?? [];
      if (added.length) {
        setCadUndoIds((stack) => [...stack, ...added].slice(-40));
      }
      setCadDoc(result.document);
      setSvg(result.svg);
      setGhostCount(result.ghost_count);
      setError(null);
      setOrchRefresh((n) => n + 1);
    },
    [],
  );

  const undoLastCad = useCallback(() => {
    const id = cadUndoIds[cadUndoIds.length - 1];
    if (!id) return;
    setStatus("Undoing…");
    setError(null);
    startTransition(async () => {
      try {
        applyCad(
          await applyCadOpsAction(projectId, [
            { op: "delete_entity", entity_id: id },
          ]),
        );
        setCadUndoIds((stack) => stack.slice(0, -1));
        setStatus("Line removed");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Undo failed");
        setStatus(null);
      }
    });
  }, [applyCad, cadUndoIds, projectId]);

  const prevModeRef = useRef(mode);
  useEffect(() => {
    const prev = prevModeRef.current;
    if (mode === "survey" && prev !== "survey") {
      setLayerOpacity((cur) => {
        layerOpacityRestore.current = cur;
        return SURVEY_LAYER_PRESET;
      });
    } else if (prev === "survey" && mode !== "survey") {
      setLayerOpacity(layerOpacityRestore.current);
    }
    if (mode !== "cad") setShowCadAdvanced(false);
    if (mode !== "sketch") {
      setSketchArmed(false);
      setSketchPaintOpen(false);
    }
    if (mode !== "quote" && mode !== "share") setQuoteToolsOpen(false);
    if (mode !== "cad" && mode !== "quote" && mode !== "share") {
      setWalkMode(false);
    }
    // Entering CAD: arm Line only when committed geometry exists.
    if (mode === "cad" && prevModeRef.current !== "cad") {
      setCadDrawArmed(committedCount > 0 && ghostCount === 0);
    }
    prevModeRef.current = mode;
  }, [mode, committedCount, ghostCount]);

  // When ghost count rises (new AI draft), leave Line off so Accept is clear.
  const prevGhostRef = useRef(ghostCount);
  useEffect(() => {
    if (
      mode === "cad" &&
      ghostCount > 0 &&
      ghostCount > prevGhostRef.current
    ) {
      setCadDrawArmed(false);
    }
    prevGhostRef.current = ghostCount;
  }, [ghostCount, mode]);

  // Entering CAD opens a blank metre-space sheet ready for line draw.
  useEffect(() => {
    if (mode !== "cad" || titleRevealActive) return;
    if (cadDoc) return;
    startTransition(async () => {
      try {
        applyCad(await ensureCadAction(projectId));
      } catch {
        /* ignore until survey exists */
      }
    });
  }, [mode, titleRevealActive, cadDoc, projectId, applyCad]);

  // Auto QS when Quote opens (anchors on Fit sheet) — keep schedule sheet closed.
  useEffect(() => {
    if (mode !== "quote" || titleRevealActive || survey || !progress.hasCad)
      return;
    startTransition(async () => {
      try {
        const res = await cadQuantitySurveyAction(projectId);
        setSurvey(res.survey);
      } catch {
        /* operator can retry from dock */
      }
    });
  }, [mode, titleRevealActive, survey, progress.hasCad, projectId]);

  useEffect(() => {
    if (useGeoStage) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.target as HTMLElement)?.closest?.(`.${css.stage}`)) return;
      e.preventDefault();
      setScale((s) =>
        Math.min(3, Math.max(0.35, s * (e.deltaY > 0 ? 0.92 : 1.08))),
      );
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [useGeoStage]);

  const boundaryRef = useRef(boundary);
  boundaryRef.current = boundary;

  const persistBoundary = useCallback(
    (next: SiteBoundaryLite, opts?: { recordHistory?: boolean }) => {
      if (opts?.recordHistory !== false) {
        boundaryHistoryRef.current = pushHistory(
          boundaryHistoryRef.current,
          boundaryRef.current,
        );
      }
      setBoundary(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        startTransition(async () => {
          try {
            const res = await saveBoundaryAction(projectId, next);
            setBoundary(res.boundary);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Boundary save failed",
            );
          }
        });
      }, 400);
    },
    [projectId],
  );

  const undoBoundary = useCallback(() => {
    const result = undoHistory(boundaryHistoryRef.current, boundaryRef.current);
    if (!result) return;
    boundaryHistoryRef.current = result.history;
    const snap = result.snapshot;
    if (snap) persistBoundary(snap, { recordHistory: false });
    else setBoundary(null);
  }, [persistBoundary]);

  const redoBoundary = useCallback(() => {
    const result = redoHistory(boundaryHistoryRef.current, boundaryRef.current);
    if (!result?.snapshot) return;
    boundaryHistoryRef.current = result.history;
    persistBoundary(result.snapshot, { recordHistory: false });
  }, [persistBoundary]);

  const commitPolygonTrace = useCallback(
    (ring: [number, number][]) => {
      if (ring.length < 3) return;
      try {
        const built = buildBoundaryFromGeoRing({
          projectId,
          ring,
          source: "HUMAN_ADDED",
          sourceKind: "manual",
          status: "UNVERIFIED",
        });
        const next: SiteBoundaryLite = {
          id: boundary?.id ?? crypto.randomUUID(),
          project_id: built.project_id,
          layer_id: built.layer_id,
          status: built.status,
          source_kind: built.source_kind,
          width_m: built.width_m,
          height_m: built.height_m,
          geo_reference: {
            crs: "EPSG:4326",
            canvas_origin_geo: built.geo_reference.canvas_origin_geo,
            metres_per_canvas_unit: 1,
          },
          calculated_metrics: built.calculated_metrics,
          vertices: built.vertices.map((v) => ({
            vertex_id: v.vertex_id,
            sequence_index: v.sequence_index,
            source: v.source,
            is_locked: v.is_locked,
            canvas_coords: v.canvas_coords,
            geo_coords: v.geo_coords,
          })),
          updated_at: new Date().toISOString(),
        };
        persistBoundary(next);
        setCanvasTool("edit");
        setBoundaryTool("edit");
        setStatus("Boundary traced — edit handles or lock title");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Trace failed");
      }
    },
    [boundary?.id, persistBoundary, projectId],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (boundaryTool !== "pan") return;
    const sketchLayer = (e.target as HTMLElement)?.closest?.(
      "[data-testid='sketch-instrument']",
    );
    if (sketchLayer?.getAttribute("data-armed") === "1") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx, ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setTx(drag.current.tx + (e.clientX - drag.current.x));
    setTy(drag.current.ty + (e.clientY - drag.current.y));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const fitSite = () => {
    if (useGeoStage) {
      setFitNonce((n) => n + 1);
      return;
    }
    applyFit();
  };

  const run = (label: string, fn: () => Promise<string | void>) => {
    setStatus(label);
    setError(null);
    startTransition(async () => {
      try {
        const settle = await fn();
        setStatus(settle ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something failed");
        setStatus(null);
      }
    });
  };

  const draftFitSheet = useCallback(() => {
    run("Drafting Fit sheet…", async () => {
      const result = await generateCadAction(projectId);
      applyCad(result);
      setShowFitSheet(true);
      setCadDrawArmed(false);
      setMode("cad");
      setFitNonce((n) => n + 1);
      return result.ghost_count > 0
        ? `${result.ghost_count} to verify — Accept (A)`
        : "Draft landed — review geometry on Fit sheet";
    });
  }, [applyCad, projectId, setMode]);

  const acceptAllGhosts = useCallback(() => {
    run("Verifying AI geometry…", async () => {
      applyCad(await acceptCadAction(projectId));
      setShowFitSheet(true);
      setCadDrawArmed(true);
      return "Geometry verified — Quote unlocked";
    });
  }, [applyCad, projectId]);

  // Canvas shortcuts — Fit sheet / CAD (Design Studio parity).
  useEffect(() => {
    if (titleRevealActive) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setKeysHelpOn((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (walkMode) {
          setWalkMode(false);
          e.preventDefault();
          return;
        }
        if (keysHelpOn) {
          setKeysHelpOn(false);
          return;
        }
        if (cadDrawArmed && mode === "cad") {
          setCadDrawArmed(false);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (mode === "cad" && cadUndoIds.length) {
          e.preventDefault();
          undoLastCad();
        } else if (boundaryHistoryRef.current.undoStack.length) {
          e.preventDefault();
          undoBoundary();
        }
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        if (boundaryHistoryRef.current.redoStack.length) {
          e.preventDefault();
          redoBoundary();
        }
        return;
      }
      if (
        (e.key.toLowerCase() === "a" || e.key === "Enter") &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        if (
          mode === "cad" &&
          ghostCount > 0 &&
          !pending &&
          !cadDrawArmed
        ) {
          e.preventDefault();
          acceptAllGhosts();
        }
        return;
      }
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
        if (
          mode === "cad" &&
          !pending &&
          ghostCount === 0 &&
          committedCount === 0
        ) {
          e.preventDefault();
          draftFitSheet();
        }
        return;
      }
      if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey) {
        if (
          (mode === "cad" || mode === "quote") &&
          showFitSheet
        ) {
          e.preventDefault();
          setShowFitDims((v) => !v);
        }
        return;
      }
      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) {
        if (mode === "cad" || mode === "quote" || mode === "sketch") {
          e.preventDefault();
          setShowFitSheet((v) => !v);
          setFitNonce((n) => n + 1);
        }
        return;
      }
      if (e.key.toLowerCase() === "l" && !e.metaKey && !e.ctrlKey) {
        if (!boundary || mode === "share") return;
        e.preventDefault();
        if (boundary.status === "VERIFIED") {
          run("Unlocking boundary…", async () => {
            const res = await unlockBoundaryAction(projectId);
            setBoundary(res.boundary);
            setBoundaryTool("edit");
          });
        } else {
          run("Locking boundary…", async () => {
            const res = await lockBoundaryAction(projectId);
            setBoundary(res.boundary);
            setBoundaryTool("pan");
            setShowFitSheet(true);
          });
        }
        return;
      }
      if (e.key === " " && mode === "cad" && ghostCount === 0) {
        e.preventDefault();
        setCadDrawArmed((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    acceptAllGhosts,
    boundary,
    cadDrawArmed,
    cadUndoIds.length,
    committedCount,
    draftFitSheet,
    ghostCount,
    keysHelpOn,
    mode,
    pending,
    projectId,
    redoBoundary,
    showFitSheet,
    titleRevealActive,
    undoBoundary,
    undoLastCad,
    walkMode,
  ]);

  const chipStyle = (anchor: { x: number; y: number }) => {
    if (!cadDoc) return { left: "50%", top: "50%" };
    const left = `${(anchor.x / cadDoc.width_m) * 100}%`;
    const top = `${(1 - anchor.y / cadDoc.height_m) * 100}%`;
    return { left, top };
  };

  const showBoundary = chrome.boundary;
  const showCadDock = chrome.cadDock;
  const showQuoteDock = chrome.quoteDock;
  const showSurveyDock = chrome.surveyDock;
  const showSketchDock = chrome.sketchDock;
  const showLiveBom = chrome.liveBom && !focusChrome && !clientView;
  const showComplianceDock =
    chrome.complianceDock && !focusChrome && !clientView;
  const showSunDock = chrome.sunGrowthDock && !focusChrome && !clientView;
  const showToolRail = chrome.toolRail && !clientView && !titleRevealActive;
  const showElevationStage = mode === "elevation" && !titleRevealActive;
  const showStage =
    titleRevealActive ||
    mode === "elevation" ||
    mode !== "sketch" ||
    Boolean(sketch);

  const complianceStats = useMemo(
    () =>
      computeSiteCompliance({
        outdoorAreaM2:
          sketch?.surveyMetrics?.garden_area_m2 ??
          boundary?.calculated_metrics.total_area_m2 ??
          sketch?.surveyMetrics?.lot_area_m2 ??
          200,
        spatialFacts: orchWorld?.spatial_facts ?? [],
        risks: orchWorld?.risks ?? [],
      }),
    [boundary, orchWorld, sketch?.surveyMetrics],
  );

  const elevationItems = useMemo(() => {
    const facts = orchWorld?.spatial_facts ?? [];
    return facts
      .filter((f) => f.x_pct != null && f.y_pct != null)
      .map((f) => ({
        id: f.id,
        label: f.label,
        x_pct: f.x_pct ?? 50,
        y_pct: f.y_pct ?? 50,
        height_m: f.height_m,
        ghost: false,
      }));
  }, [orchWorld?.spatial_facts]);

  const councilOpacity = applyBucketOpacity("council", 1, layerOpacity);
  const vegetationOpacity = applyBucketOpacity("vegetation", 1, layerOpacity);
  const boundaryOpacity = applyBucketOpacity("boundary", 1, layerOpacity);

  const layerCounts = useMemo(
    () => ({
      survey: sketchCount,
      boundary: committedCount + (boundary?.vertices.length ? 1 : 0),
      council: orchWorld?.overlays.length ?? 0,
      vegetation: sketchCount + ghostCount,
    }),
    [
      boundary?.vertices.length,
      committedCount,
      ghostCount,
      orchWorld?.overlays.length,
      sketchCount,
    ],
  );

  const openCommandPalette = useCallback(() => {
    if (mode === "sketch" && sketchCommandsRef.current) {
      sketchCommandsRef.current.openCommands();
      return;
    }
    setGlobalCommandOpen(true);
  }, [mode]);

  const workingMeta = useMemo(() => {
    if (!showFitSheet && mode !== "cad" && mode !== "quote") return null;
    const scale = fitSheetScaleLabel(
      cadDoc?.width_m ?? boundary?.width_m ?? groundSpan?.widthM ?? null,
    );
    const source =
      boundary?.source_kind === "vicmap" || lotRing.length >= 3
        ? "Vicmap Property · Land Vic"
        : (boundary?.source_kind ?? "Title");
    const area =
      sketch?.surveyMetrics?.garden_area_m2 ??
      boundary?.calculated_metrics.total_area_m2 ??
      sketch?.surveyMetrics?.lot_area_m2;
    const detail = area != null ? `${scale} · ${Math.round(area)} m²` : scale;
    return { eyebrow: "Working drawing", detail: `${source} · ${detail}` };
  }, [
    boundary,
    cadDoc?.width_m,
    groundSpan?.widthM,
    lotRing.length,
    mode,
    showFitSheet,
    sketch?.surveyMetrics,
  ]);

  const bumpOrchestration = () => setOrchRefresh((n) => n + 1);

  useEffect(() => onOrchestrationRefreshRequest(bumpOrchestration), []);

  const clearGuideParam = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("guide");
    const q = params.toString();
    router.replace(
      q ? `/projects/${projectId}?${q}` : `/projects/${projectId}`,
      { scroll: false },
    );
  }, [projectId, router, searchParams]);

  useEffect(() => {
    if (committedCount > 0) setShowGuide(false);
  }, [committedCount]);

  useEffect(() => {
    if (canvasTool === "measure") setMeasureActive(true);
    else setMeasureActive(false);
  }, [canvasTool]);

  useEffect(() => {
    if (canvasTool === "edit") setBoundaryTool("edit");
    else if (
      canvasTool === "trace" ||
      canvasTool === "pan" ||
      canvasTool === "measure" ||
      canvasTool === "add"
    ) {
      setBoundaryTool("pan");
    }
    if (canvasTool === "add") {
      setMode("sketch");
      setSketchPaintOpen(true);
    }
  }, [canvasTool]);

  useEffect(() => {
    if (canvasTool !== "lock" && canvasTool !== "reset") return;
    const tool = canvasTool;
    setCanvasTool("pan");
    if (tool === "lock") {
      if (!boundaryRef.current || boundaryRef.current.status === "VERIFIED") {
        return;
      }
      run("Locking boundary…", async () => {
        const res = await lockBoundaryAction(projectId);
        setBoundary(res.boundary);
        setBoundaryTool("pan");
        setShowFitSheet(true);
      });
      return;
    }
    run("Resetting boundary…", async () => {
      await resetBoundaryAction(projectId);
      setBoundary(null);
    });
  }, [canvasTool, projectId]);

  useEffect(() => {
    if (!pending) {
      setAutosaveLabel("Saved");
      const t = setTimeout(() => setAutosaveLabel(null), 2200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [pending, cadDoc, sketchCount, ghostCount]);

  return (
    <div
      className={`${css.root}${walkMode && canWalk ? ` ${css.rootWalk}` : ""}${focusChrome ? ` ${css.rootFocus}` : ""}${darkCanvas ? ` ${css.rootDark}` : ""}${clientView ? ` ${css.rootClient}` : ""}`}
      data-testid="site-canvas"
      data-canvas-mode={mode}
      data-title-reveal={titleRevealActive ? "1" : undefined}
      data-walk={walkMode && canWalk ? "1" : undefined}
      data-paper-size={showFitSheet ? paperSize : undefined}
    >
      {!titleRevealActive ? (
        <CanvasStudioHeader
          projectId={projectId}
          projectAddress={projectAddress}
          mode={mode}
          progress={progress}
          onMode={setMode}
          paper={showFitSheet}
          showFitSheet={showFitSheet}
          onToggleFitSheet={() => {
            setShowFitSheet((v) => !v);
            setFitNonce((n) => n + 1);
          }}
          paperSize={paperSize}
          onPaperSize={setPaperSize}
          sheetElevations={sheetElevations}
          onToggleSheetElevations={() => setSheetElevations((v) => !v)}
          darkCanvas={darkCanvas}
          onToggleDarkCanvas={() => setDarkCanvas((v) => !v)}
          clientView={clientView}
          onToggleClientView={() => setClientView((v) => !v)}
          clientViewActive={clientView}
          autosaveLabel={autosaveLabel}
          showCadLine={mode === "cad"}
          cadDrawArmed={cadDrawArmed}
          onToggleCadDraw={() => setCadDrawArmed((v) => !v)}
          ghostCount={ghostCount}
          onAcceptGhosts={ghostCount > 0 ? acceptAllGhosts : undefined}
          keysHelpOn={keysHelpOn}
          onToggleKeysHelp={() => setKeysHelpOn((v) => !v)}
          workingMeta={workingMeta}
          viewLayers={viewLayers}
          onViewLayersChange={setViewLayers}
          layerOpacity={layerOpacity}
          onLayerOpacityChange={setLayerOpacity}
          layerCounts={layerCounts}
          onOpenCommands={openCommandPalette}
          onShare={() => setMode("share")}
          focusChrome={focusChrome}
          onToggleFocusChrome={() => setFocusChrome((v) => !v)}
          hideBrand={useGeoStage}
        />
      ) : null}

      {!titleRevealActive && showGuide && aerialUri && committedCount === 0 ? (
        <FirstRunGuide
          projectId={projectId}
          onDismiss={() => {
            setShowGuide(false);
            clearGuideParam();
          }}
          onDone={(nextMode, ghosts = 0, cad = null) => {
            setShowGuide(false);
            clearGuideParam();
            setShowFitSheet(true);
            setTitleOpened(true);
            if (cad) {
              applyCad({
                document: cad.document as CadDocumentLite | null,
                svg: cad.svg,
                ghost_count: cad.ghost_count,
              });
            } else {
              setGhostCount(ghosts);
            }
            // Ghosts → review/accept; only arm Line when clean committed geometry.
            setCadDrawArmed(nextMode === "cad" && ghosts === 0);
            setMode(nextMode);
            setFitNonce((n) => n + 1);
            bumpOrchestration();
            setStatus(
              nextMode === "cad"
                ? ghosts > 0
                  ? `${ghosts} to verify — Accept (A)`
                  : "Fit sheet ready — Draft with AI or draw"
                : "Sketch ready on the lot",
            );
            router.refresh();
          }}
        />
      ) : null}

      {keysHelpOn ? (
        <div className={css.keysHelp} data-testid="canvas-keys-help">
          <p className={css.dockKicker}>Shortcuts · {mode}</p>
          <ul>
            {(mode === "cad" || mode === "quote" || mode === "sketch") && (
              <li>
                <kbd>F</kbd> Fit sheet
              </li>
            )}
            {mode === "cad" && (
              <>
                <li>
                  <kbd>Space</kbd> Line draw
                </li>
                <li>
                  <kbd>G</kbd> Draft with AI
                </li>
                <li>
                  <kbd>A</kbd> / <kbd>Enter</kbd> Verify AI geometry
                </li>
                <li>
                  <kbd>⌘Z</kbd> Undo line
                </li>
                <li>
                  <kbd>Enter</kbd> Finish line
                </li>
              </>
            )}
            {(mode === "cad" || mode === "quote") && (
              <li>
                <kbd>D</kbd> Edge dims
              </li>
            )}
            {mode === "survey" && (
              <li>
                <kbd>L</kbd> Lock / unlock title
              </li>
            )}
            {(mode === "cad" || mode === "quote" || mode === "share") && (
              <li>
                <kbd>Esc</kbd> Exit Walk / clear
              </li>
            )}
            {mode === "sketch" && (
              <li>
                <kbd>Esc</kbd> Disarm brush
              </li>
            )}
          </ul>
          <button
            type="button"
            className={css.btnGhost}
            onClick={() => setKeysHelpOn(false)}
          >
            Close
          </button>
        </div>
      ) : null}

      {showComplianceDock ? (
        <ComplianceDock
          stats={complianceStats}
          paper={showFitSheet}
          collapsed={complianceCollapsed}
          onToggleCollapsed={() => setComplianceCollapsed((v) => !v)}
        />
      ) : null}

      {showLiveBom ? (
        <LiveBomHud
          projectId={projectId}
          refreshKey={orchRefresh}
          paper={showFitSheet}
          compact={mode === "cad"}
          onWorld={setOrchWorld}
        />
      ) : null}

      {mode === "sketch" && !sketch ? (
        <div className={css.shareSheet}>
          <h2>Sketch</h2>
          <p>Run survey first so the aerial is available for sketching.</p>
          <button
            type="button"
            className={`${css.btn} ${css.btnPrimary}`}
            disabled={pending}
            onClick={() =>
              run("Running survey…", async () => {
                const fd = new FormData();
                fd.set("projectId", projectId);
                await runSurveyAction(fd);
                router.refresh();
                setMode("survey");
              })
            }
          >
            Run survey
          </button>
        </div>
      ) : null}

      {showToolRail ? (
        <CanvasToolRail
          tool={canvasTool}
          onTool={setCanvasTool}
          onZoomIn={() => setFitNonce((n) => n + 1)}
          onZoomOut={() => setFitNonce((n) => n + 1)}
          onZoomFit={() => setFitNonce((n) => n + 1)}
        />
      ) : null}

      {showSunDock && mapView && fallbackCenter ? (
        <div className={css.sunDock}>
          <SunShadeControls
            lat={fallbackCenter.lat}
            lng={fallbackCenter.lng}
            when={sunWhen}
            onWhenChange={setSunWhen}
          />
        </div>
      ) : null}

      {!titleRevealActive && !clientView ? <CanvasCoachMarks /> : null}

      {showElevationStage ? (
        <ElevationProfile
          items={elevationItems}
          selectedId={selectedElevationId}
          onSelect={setSelectedElevationId}
          onTraceInPlan={() => setMode("cad")}
        />
      ) : null}

      {showStage && !showElevationStage ? (
        <>
          <div
            ref={stageRef}
            className={`${css.stage}${useGeoStage ? ` ${css.stageGeo}` : ""}${
              walkMode && canWalk
                ? ` ${css.stageWalk}${showFitSheet ? ` ${css.stageWalkPaper}` : ""}`
                : ""
            }`}
            onPointerDown={useGeoStage ? undefined : onPointerDown}
            onPointerMove={useGeoStage ? undefined : onPointerMove}
            onPointerUp={useGeoStage ? undefined : onPointerUp}
          >
            {useGeoStage && mapConfig ? (
              titleRevealActive ? (
                <GeoSiteMap
                  phase="title"
                  onTitleOpen={openTitleDrawing}
                  styleSatellite={mapConfig.styles.satellite}
                  styleStreets={mapConfig.styles.streets}
                  boundary={boundary}
                  lotRing={lotRing}
                  houseRing={[]}
                  fallbackCenter={fallbackCenter}
                  tool="pan"
                  onBoundaryChange={persistBoundary}
                  fitNonce={fitNonce}
                  allowMapPan
                />
              ) : (
                <ArchitecturalSheet
                  address={projectAddress}
                  drawingTitle={
                    mode === "sketch"
                      ? "Garden concept"
                      : mode === "cad"
                        ? "Garden working drawing"
                        : mode === "quote"
                          ? "Quoted garden plan"
                          : "Garden plan"
                  }
                  sourceLabel={
                    boundary?.source_kind === "vicmap" || lotRing.length >= 3
                      ? "Vicmap Property · Land Vic"
                      : (boundary?.source_kind ?? "Title")
                  }
                  areaM2={
                    sketch?.surveyMetrics?.garden_area_m2 ??
                    boundary?.calculated_metrics.total_area_m2 ??
                    sketch?.surveyMetrics?.lot_area_m2 ??
                    null
                  }
                  locked={boundary?.status === "VERIFIED"}
                  groundWidthM={
                    cadDoc?.width_m ??
                    boundary?.width_m ??
                    groundSpan?.widthM ??
                    (sketch?.surveyMetrics?.garden_area_m2
                      ? Math.sqrt(sketch.surveyMetrics.garden_area_m2)
                      : null)
                  }
                  fitSheet={
                    showFitSheet &&
                    (mode === "cad" ||
                      mode === "sketch" ||
                      mode === "quote" ||
                      mode === "share")
                  }
                  paperSize={paperSize}
                >
                  <GeoSiteMap
                    phase="design"
                    sheetMode
                    paperMode={
                      showFitSheet &&
                      (mode === "cad" ||
                        mode === "sketch" ||
                        mode === "quote" ||
                        mode === "share")
                    }
                    styleSatellite={mapConfig.styles.satellite}
                    styleStreets={mapConfig.styles.streets}
                    boundary={boundary}
                    lotRing={lotRing}
                    houseRing={sketch?.houseRing ?? []}
                    buildingHeightM={
                      (sketch?.surveyMetrics?.house_area_m2 ?? 0) > 180
                        ? 6.5
                        : 5
                    }
                    fallbackCenter={fallbackCenter}
                    tool={
                      mode === "share"
                        ? "pan"
                        : mode === "sketch" || (mode === "cad" && cadDrawArmed)
                          ? "pan"
                          : boundaryTool
                    }
                    onBoundaryChange={persistBoundary}
                    fitNonce={fitNonce}
                    allowMapPan={
                      mode === "share"
                        ? true
                        : mode === "sketch"
                          ? !sketchArmed
                          : mode === "cad"
                            ? !cadDrawArmed
                            : true
                    }
                    lineDrawActive={mode === "cad" && cadDrawArmed}
                    polygonTraceActive={
                      canvasTool === "trace" &&
                      mode !== "share" &&
                      boundary?.status !== "VERIFIED"
                    }
                    onPolygonTraceCommit={commitPolygonTrace}
                    boundaryOpacity={boundaryOpacity}
                    councilOpacity={councilOpacity}
                    showSetback={viewLayers.setback}
                    fitSheetShowDims={showFitDims}
                    onLineCommit={(points) => {
                      if (points.length < 2) return;
                      let lenM = 0;
                      for (let i = 1; i < points.length; i++) {
                        const a = points[i - 1]!;
                        const b = points[i]!;
                        lenM += Math.hypot(b.x - a.x, b.y - a.y);
                      }
                      run("Saving line…", async () => {
                        applyCad(
                          await applyCadOpsAction(projectId, [
                            {
                              op: "add_polyline",
                              layer: "HARDSCAPE",
                              points,
                              closed: false,
                              ghost: false,
                            },
                          ]),
                        );
                        return `Line ${lenM.toFixed(1)} m · ⌘Z undo`;
                      });
                    }}
                    fitSheetMeta={{
                      brand: "Curtis & Co",
                      address: projectAddress,
                      drawingTitle:
                        mode === "sketch"
                          ? "Garden concept"
                          : mode === "cad"
                            ? "Garden working drawing"
                            : mode === "quote"
                              ? "Quoted garden plan"
                              : mode === "share"
                                ? "Client garden plan"
                                : "Garden plan",
                      sourceLabel:
                        boundary?.source_kind === "vicmap" ||
                        lotRing.length >= 3
                          ? "Vicmap Property · Land Vic"
                          : (boundary?.source_kind ?? "Title"),
                      scaleLabel: fitSheetScaleLabel(
                        cadDoc?.width_m ??
                          boundary?.width_m ??
                          groundSpan?.widthM ??
                          null,
                      ),
                      areaM2:
                        sketch?.surveyMetrics?.garden_area_m2 ??
                        boundary?.calculated_metrics.total_area_m2 ??
                        sketch?.surveyMetrics?.lot_area_m2 ??
                        null,
                      revision:
                        mode === "cad"
                          ? "Rev A · CAD working"
                          : mode === "quote" || mode === "share"
                            ? "Rev A · quoted"
                            : "Rev A · concept",
                      jobRef: projectId.slice(0, 8).toUpperCase(),
                    }}
                    cadSvg={
                      svg &&
                      (mode === "cad" ||
                        mode === "quote" ||
                        mode === "share")
                        ? svg
                        : null
                    }
                    cadWidthM={cadDoc?.width_m ?? boundary?.width_m ?? null}
                    cadHeightM={
                      cadDoc?.height_m ?? boundary?.height_m ?? null
                    }
                    designOverlay={
                      mode === "sketch" && sketch ? (
                        <SketchInstrument
                          projectId={projectId}
                          symbols={sketch.symbols}
                          rateCard={sketch.rateCard}
                          initialPlacements={sketch.canvas?.placements ?? []}
                          onPlacementCount={setSketchCount}
                          mapView={mapView}
                          worldWidthPx={worldSize.width}
                          worldHeightPx={worldSize.height}
                          tier1={tier1}
                          chromeHost={sketchChromeHost}
                          onArmedChange={setSketchArmed}
                          onDraftCad={draftFitSheet}
                          showRibbon={sketchPaintOpen}
                          viewLayers={viewLayers}
                          onToggleViewLayer={(key) =>
                            setViewLayers((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))
                          }
                          onRegisterCommands={(api) => {
                            sketchCommandsRef.current = api;
                          }}
                          measureActive={measureActive}
                          onToggleMeasure={() => setMeasureActive((v) => !v)}
                          onGoToQuote={() => setMode("quote")}
                          showGhostSuggestions={viewLayers.ghostSuggestions}
                          selectMode={canvasTool === "edit"}
                          vegetationOpacity={vegetationOpacity}
                        />
                      ) : mode === "quote" ||
                        mode === "cad" ||
                        mode === "share" ? (
                        <SheetAnchorsOverlay
                          widthM={
                            cadDoc?.width_m ?? boundary?.width_m ?? 1
                          }
                          heightM={
                            cadDoc?.height_m ?? boundary?.height_m ?? 1
                          }
                          qsRows={
                            mode === "quote" || mode === "share"
                              ? survey?.rows
                              : null
                          }
                          overlays={orchWorld?.overlays ?? null}
                        />
                      ) : null
                    }
                  />
                </ArchitecturalSheet>
              )
            ) : (
              <>
                <div
                  className={css.draftGrid}
                  aria-hidden
                  data-testid="canvas-draft-grid"
                />
                <div
                  className={css.world}
                  style={{
                    width: worldSize.width,
                    height: worldSize.height,
                    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                  }}
                  data-ground-w={
                    groundSpan ? groundSpan.widthM.toFixed(1) : undefined
                  }
                  data-ground-h={
                    groundSpan ? groundSpan.heightM.toFixed(1) : undefined
                  }
                >
                  {activeAerial ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={css.aerial}
                      src={activeAerial}
                      alt={`Aerial — ${projectAddress}`}
                      draggable={false}
                      onLoad={(e) => onAerialLoad(e.currentTarget)}
                    />
                  ) : (
                    <div
                      className={css.aerial}
                      style={{
                        background:
                          "linear-gradient(145deg, #fceef4 0%, #e8dfe4 100%)",
                      }}
                    />
                  )}
                  {mapView && lotRing.length >= 3 ? (
                    <TitleParcelOverlay lotRing={lotRing} mapView={mapView} />
                  ) : null}
                  {mode === "sketch" && sketch ? (
                    <SketchInstrument
                      projectId={projectId}
                      symbols={sketch.symbols}
                      rateCard={sketch.rateCard}
                      initialPlacements={sketch.canvas?.placements ?? []}
                      onPlacementCount={setSketchCount}
                      mapView={mapView}
                      worldWidthPx={worldSize.width}
                      worldHeightPx={worldSize.height}
                      tier1={tier1}
                      onDraftCad={draftFitSheet}
                      showRibbon={sketchPaintOpen}
                      viewLayers={viewLayers}
                      onToggleViewLayer={(key) =>
                        setViewLayers((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                      onRegisterCommands={(api) => {
                        sketchCommandsRef.current = api;
                      }}
                      measureActive={measureActive}
                      onToggleMeasure={() => setMeasureActive((v) => !v)}
                      onGoToQuote={() => setMode("quote")}
                      showGhostSuggestions={viewLayers.ghostSuggestions}
                      selectMode={canvasTool === "edit"}
                      vegetationOpacity={vegetationOpacity}
                    />
                  ) : null}
                  <MeasureOverlay
                    mapView={mapView}
                    worldWidthPx={worldSize.width}
                    worldHeightPx={worldSize.height}
                    active={measureActive}
                    points={measurePts}
                    onPointsChange={setMeasurePts}
                    paper={showFitSheet}
                  />
                  {svg && (mode === "cad" || mode === "quote") ? (
                    <div
                      className={`${css.cadLayer} ${ghostCount > 0 ? css.cadLayerGhost : ""}`}
                      style={{ opacity: boundaryOpacity }}
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  ) : null}
                  {showBoundary ? (
                    <div className={css.boundaryHost}>
                      <BoundaryOverlay
                        boundary={boundary}
                        tool={boundaryTool}
                        onChange={persistBoundary}
                        mapView={mapView}
                      />
                    </div>
                  ) : null}
                  {mode === "quote" &&
                    survey?.rows.slice(0, 24).map((row) => (
                      <span
                        key={row.id}
                        className={css.chip}
                        style={chipStyle(row.anchor)}
                      >
                        {row.qty} {row.unit}
                      </span>
                    ))}
                  {(mode === "cad" || mode === "quote") &&
                    orchWorld?.overlays
                      .filter((o) => o.status === "ready")
                      .map((o) =>
                        o.x_pct != null && o.y_pct != null ? (
                          <span
                            key={o.id}
                            className={`${css.chip} ${css.overlayGhost}`}
                            style={{ left: `${o.x_pct}%`, top: `${o.y_pct}%` }}
                            title={o.detail}
                          >
                            {o.kind === "trp_ring"
                              ? "TRP"
                              : o.kind === "drainage"
                                ? "Drain"
                                : "Hold"}
                          </span>
                        ) : null,
                      )}
                </div>
                {!mapConfig &&
                (hasParcelGeo || fallbackCenter) &&
                mode !== "sketch" ? (
                  <GeoSiteMapFallback address={projectAddress} />
                ) : null}
              </>
            )}

            {canWalk ? (
              <ClayWalkthrough
                active={walkMode}
                rings={clayScene.rings}
                polylines={clayScene.polylines}
                plants={clayScene.plants}
                paper={showFitSheet}
                onRequestExit={() => setWalkMode(false)}
              />
            ) : null}

            {!titleRevealActive &&
            mode === "cad" &&
            !pending &&
            ghostCount === 0 &&
            committedCount === 0 &&
            !cadDrawArmed ? (
              <div
                className={`${css.emptyHint} ${css.emptyHintAction}${showFitSheet ? ` ${css.emptyHintPaper}` : ""}`}
              >
                <strong>Blank Fit sheet</strong>
                <p>
                  Draft with AI (G) for a first pass, or arm Line to draw on the
                  cream sheet.
                </p>
                <div className={css.emptyHintActions}>
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    data-testid="cad-generate-empty"
                    onClick={draftFitSheet}
                  >
                    Draft with AI →
                  </button>
                  <button
                    type="button"
                    className={css.btn}
                    onClick={() => setCadDrawArmed(true)}
                  >
                    Draw line
                  </button>
                </div>
              </div>
            ) : null}
            {!titleRevealActive &&
            mode === "cad" &&
            !pending &&
            ghostCount > 0 &&
            !cadDrawArmed ? (
              <div
                className={`${css.emptyHint} ${css.emptyHintAction} ${css.ghostReview}${showFitSheet ? ` ${css.emptyHintPaper}` : ""}`}
                data-testid="cad-ghost-review"
              >
                <GhostReviewCard
                  title="AI CAD geometry"
                  why="Generated metre geometry on the Fit sheet — verify before quote."
                  confidence={0.78}
                  suggestionId={`cad-ghost-${ghostCount}`}
                  onAccept={acceptAllGhosts}
                  onReject={() => setCadDrawArmed(true)}
                />
              </div>
            ) : null}
            {!titleRevealActive &&
            mode === "sketch" &&
            sketchCount === 0 &&
            !pending ? (
              <div className={css.emptyHint}>
                <strong>Design the garden</strong>
                <p>
                  You&apos;re on the outdoor yard - not the house, not the
                  street. Paint materials on the garden.
                </p>
              </div>
            ) : null}
          </div>

          {!titleRevealActive && mapView && mode !== "share" && !useGeoStage ? (
            <DraftingHud
              mapView={mapView}
              worldWidthPx={worldSize.width}
              worldHeightPx={worldSize.height}
              viewScale={scale}
              measureActive={measureActive}
              onMeasureActiveChange={(on) => {
                setMeasureActive(on);
                if (!on) setMeasurePts([]);
              }}
              measureDistanceM={measureDistanceMetres(
                measurePts,
                mapView,
                worldSize.width,
                worldSize.height,
              )}
              measureHint={
                measureActive
                  ? measurePts.length === 0
                    ? "Tap start point"
                    : measurePts.length === 1
                      ? "Tap end point"
                      : null
                  : null
              }
            />
          ) : null}

          {!titleRevealActive && useGeoStage && mode !== "survey" ? (
            <div
              className={`${css.sheetHud}${showFitSheet ? ` ${css.sheetHudPaper}` : ""}`}
              data-testid="geo-sheet-hud"
            >
              <span className={css.sheetHudScale}>
                {fitSheetScaleLabel(
                  cadDoc?.width_m ??
                    boundary?.width_m ??
                    groundSpan?.widthM ??
                    null,
                )}
              </span>
              <span className={css.sheetHudMeta}>
                {walkMode
                  ? "Clay walk"
                  : showFitSheet
                    ? "Fit sheet · north up"
                    : "Aerial · title frame"}
              </span>
              {walkMode ? (
                <span className={css.sheetHudHint}>Esc · Exit walk</span>
              ) : measureActive ? (
                <span className={css.sheetHudHint}>
                  Measure · tap two points
                </span>
              ) : mode === "cad" && ghostCount > 0 && !cadDrawArmed ? (
                <span className={css.sheetHudHint}>
                  {ghostCount} to verify · A Accept
                </span>
              ) : mode === "cad" &&
                committedCount === 0 &&
                !cadDrawArmed ? (
                <span className={css.sheetHudHint}>Draft with AI or Line</span>
              ) : mode === "cad" && cadDrawArmed ? (
                <span className={css.sheetHudHint}>Line · Enter finish</span>
              ) : mode === "share" ? (
                <span className={css.sheetHudHint}>Client preview</span>
              ) : null}
            </div>
          ) : null}

          {showBoundary ? (
            <BoundaryChrome
              boundary={boundary}
              tool={boundaryTool}
              pending={pending}
              onToolChange={setBoundaryTool}
              onAutoTrace={() =>
                run("Tracing parcel…", async () => {
                  const res = await autoTraceBoundaryAction(projectId);
                  setBoundary(res.boundary);
                  setBoundaryTool("edit");
                })
              }
              onLock={() =>
                run("Locking boundary…", async () => {
                  const res = await lockBoundaryAction(projectId);
                  setBoundary(res.boundary);
                  setBoundaryTool("pan");
                  setShowFitSheet(true);
                  return "Title locked - Fit sheet ready";
                })
              }
              onUnlock={() =>
                run("Unlocking boundary…", async () => {
                  const res = await unlockBoundaryAction(projectId);
                  setBoundary(res.boundary);
                  setBoundaryTool("edit");
                })
              }
              onReset={() =>
                run("Resetting boundary…", async () => {
                  await resetBoundaryAction(projectId);
                  setBoundary(null);
                  setBoundaryTool("pan");
                })
              }
              onOpenFitSheet={openTitleDrawing}
            />
          ) : null}

          {(mode === "quote" || mode === "cad") &&
          sheet !== "none" &&
          (survey || build) ? (
            <aside
              className={`${css.sheet}${showFitSheet ? ` ${css.scheduleSheetPaper}` : ""}`}
              aria-label="Schedule sheet"
            >
              <button
                type="button"
                className={css.sheetClose}
                onClick={() => setSheet("none")}
                aria-label="Close"
              >
                ×
              </button>
              <h2 className={css.sheetTitle}>
                {sheet === "qs" ? "Quantity survey" : "Itemised build"}
              </h2>
              {sheet === "qs" && survey ? (
                <>
                  <table className={css.table}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {survey.rows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.label}</td>
                          <td>
                            {r.qty} {r.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={css.totals}>
                    Hardscape {survey.totals.hardscape_m2} m² · Planting{" "}
                    {survey.totals.planting_ea} ea · Irrigation{" "}
                    {survey.totals.irrigation_lm} lm
                  </div>
                </>
              ) : null}
              {sheet === "build" && build ? (
                <>
                  <table className={css.table}>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Qty</th>
                        <th>$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {build.line_items.map((l) => (
                        <tr key={`${l.sku}-${l.label}`}>
                          <td>{l.label}</td>
                          <td>
                            {l.qty} {l.unit}
                          </td>
                          <td>{l.total.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={css.totals}>
                    Subtotal ${build.subtotal.toFixed(0)}
                    <br />
                    Contingency ${build.contingency.toFixed(0)}
                    <br />
                    GST ${build.gst.toFixed(0)}
                    <br />
                    <strong>Total ${build.total.toFixed(0)}</strong>
                  </div>
                </>
              ) : null}
            </aside>
          ) : null}

          {showSurveyDock ? (
            <div
              className={`${css.dock}${showFitSheet ? ` ${css.dockPaper}` : ""}`}
              data-testid="survey-dock"
            >
              <div className={css.dockIntro}>
                <p className={css.dockKicker}>Survey</p>
                <p className={css.dockPrimaryHint}>
                  {hasParcelGeo || aerialUri
                    ? "Vicmap title is the sheet — open Fit sheet to draft in ink"
                    : "Load Vicmap title + aerial for this address"}
                </p>
              </div>
              <div className={css.btnRow}>
                {!aerialUri && !hasParcelGeo ? (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    disabled={pending}
                    onClick={() =>
                      run("Loading Vicmap title…", async () => {
                        const fd = new FormData();
                        fd.set("projectId", projectId);
                        await runSurveyAction(fd);
                        try {
                          const res = await autoTraceBoundaryAction(projectId);
                          setBoundary(res.boundary);
                          setBoundaryTool("pan");
                          setFitNonce((n) => n + 1);
                        } catch {
                          /* lot ring still paints from survey */
                        }
                        router.refresh();
                      })
                    }
                  >
                    Load site
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`${css.btn} ${css.btnPrimary}`}
                      data-testid="start-cad-drawing"
                      onClick={() => openTitleDrawing()}
                    >
                      Open Fit sheet →
                    </button>
                    <button
                      type="button"
                      className={css.btn}
                      onClick={() => setMode("sketch")}
                    >
                      Sketch first
                    </button>
                  </>
                )}
              </div>
              <div className={`${css.status} ${error ? css.error : ""}`}>
                {error ??
                  status ??
                  (useGeoStage
                    ? boundary?.status === "VERIFIED"
                      ? "Title locked — Open Fit sheet to draw lines on paper"
                      : hasParcelGeo
                        ? "Vicmap on canvas — Open Fit sheet, or Lock when the outline reads true"
                        : "Geo canvas ready — Load site to pull Vicmap parcel"
                    : aerialUri
                      ? "Static aerial fallback — Mapbox token needed for live geo canvas"
                      : "Load Vicmap parcel + aerial onto the geo canvas")}
              </div>
            </div>
          ) : null}

          {showSketchDock ? (
            <div
              className={`${css.dock}${showFitSheet ? ` ${css.dockPaper}` : ""}`}
            >
              <div
                ref={setSketchChromeHost}
                className={css.sketchChromeHost}
                data-testid="sketch-chrome-host"
              />
              <p className={css.dockPrimaryHint}>
                {!sketchPaintOpen
                  ? "Garden only — open Paint when you are ready to place materials"
                  : sketchCount === 0
                    ? "Pick a brush, then paint the yard"
                    : "Garden concept on the sheet — draft the working drawing next"}
              </p>
              <div className={css.btnRow}>
                <button
                  type="button"
                  className={`${css.btn} ${sketchPaintOpen ? "" : css.btnPrimary}`}
                  aria-pressed={sketchPaintOpen}
                  data-testid="sketch-paint-open"
                  onClick={() => setSketchPaintOpen((v) => !v)}
                >
                  {sketchPaintOpen ? "Hide brushes" : "Paint"}
                </button>
                <button
                  type="button"
                  className={`${css.btn} ${sketchCount > 0 ? css.btnPrimary : ""}`}
                  disabled={pending || sketchCount === 0}
                  onClick={() =>
                    run("Drafting Fit sheet…", async () => {
                      const result = await generateCadAction(projectId);
                      applyCad(result);
                      setShowFitSheet(true);
                      setCadDrawArmed(false);
                      setMode("cad");
                      setFitNonce((n) => n + 1);
                      return result.ghost_count > 0
                        ? `${result.ghost_count} to verify — Accept (A)`
                        : "Fit sheet drafted from sketch";
                    })
                  }
                >
                  Draft Fit sheet →
                </button>
              </div>
              <div className={`${css.status} ${error ? css.error : ""}`}>
                {error ??
                  status ??
                  (sketchCount > 0
                    ? `${sketchCount} placements · Alt+click to sample a brush`
                    : "Same world as Survey and CAD — not a separate studio")}
              </div>
            </div>
          ) : null}

          {showCadDock ? (
            <div
              className={`${css.dock}${showFitSheet ? ` ${css.dockPaper}` : ""}`}
              data-testid="cad-dock"
            >
              <div className={css.dockIntro}>
                <p className={css.dockKicker}>CAD</p>
                <p className={css.dockPrimaryHint}>
                  {cadDrawArmed
                    ? showFitSheet
                      ? "Fit sheet — click vertices, Enter / double-click finish, Esc clear"
                      : "Line draw — click points, Enter / double-click finish"
                    : ghostCount > 0
                      ? `${ghostCount} to verify — Accept (A) before Quote`
                      : committedCount === 0
                        ? "Blank sheet — Draft with AI, or Line to draw by hand"
                        : "Working drawing — live estimate updates as geometry lands"}
                </p>
              </div>
              {showCadAdvanced ? (
                <div className={css.promptRow}>
                  <input
                    className={css.prompt}
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Ask CAD… e.g. add paving path along the fence"
                    disabled={pending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && instruction.trim()) {
                        run("Editing CAD…", async () => {
                          applyCad(
                            await editCadAction(projectId, instruction.trim()),
                          );
                          setInstruction("");
                        });
                      }
                    }}
                  />
                </div>
              ) : null}
              <div className={css.btnRow}>
                {ghostCount > 0 ? (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    disabled={pending}
                    data-testid="cad-accept-ghosts-dock"
                    title="Verify and accept AI geometry (A)"
                    onClick={acceptAllGhosts}
                  >
                    Accept ({ghostCount})
                  </button>
                ) : committedCount > 0 ? (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    onClick={() => {
                      setShowFitSheet(true);
                      setMode("quote");
                    }}
                  >
                    Review price →
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    disabled={pending}
                    data-testid="cad-generate"
                    onClick={draftFitSheet}
                  >
                    Draft with AI
                  </button>
                )}
                <button
                  type="button"
                  className={`${css.btn} ${cadDrawArmed ? css.btnPrimary : ""}`}
                  data-testid="cad-line-draw"
                  aria-pressed={cadDrawArmed}
                  disabled={ghostCount > 0}
                  title={
                    ghostCount > 0
                      ? "Accept AI geometry before drawing"
                      : "Line draw (Space)"
                  }
                  onClick={() => setCadDrawArmed((v) => !v)}
                >
                  {cadDrawArmed ? "Drawing…" : "Line"}
                </button>
                <button
                  type="button"
                  className={`${css.btn}${walkMode ? ` ${css.btnPrimary}` : ""}`}
                  data-testid="cad-walk"
                  aria-pressed={walkMode}
                  title="Clay walkthrough (WASD · Esc exit)"
                  onClick={() => setWalkMode((v) => !v)}
                >
                  {walkMode ? "Exit walk" : "Walk"}
                </button>
                <button
                  type="button"
                  className={css.dockToggle}
                  onClick={() => setShowCadAdvanced((v) => !v)}
                >
                  {showCadAdvanced ? "Fewer tools" : "More tools"}
                </button>
              </div>
              {showCadAdvanced ? (
                <div className={`${css.btnRow} ${css.dockMore}`}>
                  <button
                    type="button"
                    className={`${css.btn} ${showFitSheet ? css.btnPrimary : ""}`}
                    data-testid="fit-sheet-toggle"
                    aria-pressed={showFitSheet}
                    title="Paper working drawing (F)"
                    onClick={() => {
                      setShowFitSheet((v) => !v);
                      setFitNonce((n) => n + 1);
                    }}
                  >
                    Fit sheet
                  </button>
                  <button
                    type="button"
                    className={css.btn}
                    aria-pressed={showFitDims}
                    disabled={!showFitSheet}
                    title="Parcel edge dimensions (D)"
                    onClick={() => setShowFitDims((v) => !v)}
                  >
                    {showFitDims ? "Dims on" : "Dims"}
                  </button>
                  <button
                    type="button"
                    className={css.btn}
                    data-testid="fit-sheet"
                    title="Fit camera to title parcel"
                    onClick={() => setFitNonce((n) => n + 1)}
                  >
                    Fit view
                  </button>
                  <button
                    type="button"
                    className={css.btn}
                    data-testid="cad-undo"
                    disabled={pending || cadUndoIds.length === 0}
                    title="Undo last line (⌘/Ctrl+Z)"
                    onClick={() => undoLastCad()}
                  >
                    Undo
                  </button>
                  {committedCount > 0 || ghostCount > 0 ? (
                    <button
                      type="button"
                      className={css.btn}
                      disabled={pending}
                      onClick={() =>
                        run("Regenerating Fit sheet…", async () => {
                          const result = await generateCadAction(projectId);
                          applyCad(result);
                          setShowFitSheet(true);
                          setCadDrawArmed(false);
                          return result.ghost_count > 0
                            ? `${result.ghost_count} to verify — Accept (A)`
                            : "Fit sheet regenerated";
                        })
                      }
                    >
                      Regenerate
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={css.btn}
                    disabled={pending || !instruction.trim()}
                    onClick={() =>
                      run("Editing CAD…", async () => {
                        applyCad(
                          await editCadAction(projectId, instruction.trim()),
                        );
                        setInstruction("");
                      })
                    }
                  >
                    Apply edit
                  </button>
                  <button
                    type="button"
                    className={css.btn}
                    disabled={pending || !cadDoc}
                    onClick={() =>
                      run("Exporting DXF…", async () => {
                        const text = await downloadCadDxfAction(projectId);
                        const blob = new Blob([text], {
                          type: "application/dxf",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = window.document.createElement("a");
                        a.href = url;
                        a.download = `workstream-${projectId.slice(0, 8)}.dxf`;
                        a.click();
                        URL.revokeObjectURL(url);
                        return "DXF downloaded";
                      })
                    }
                  >
                    DXF
                  </button>
                </div>
              ) : null}
              <div className={`${css.status} ${error ? css.error : ""}`}>
                {error ??
                  status ??
                  (ghostCount > 0
                    ? `${ghostCount} to verify · A Accept · then Quote`
                    : committedCount > 0
                      ? `${committedCount} verified · ready for Quote`
                      : "Draft or draw — Quote unlocks after accept")}
              </div>
            </div>
          ) : null}

          {showQuoteDock ? (
            <div
              className={`${css.dock} ${css.dockSlim}${showFitSheet ? ` ${css.dockPaper}` : ""}`}
              data-testid="canvas-quote-dock"
            >
              <div className={css.dockIntro}>
                <p className={css.dockKicker}>Quote</p>
                <p className={css.dockPrimaryHint}>
                  {!progress.hasCad
                    ? ghostCount > 0
                      ? "Verify AI geometry on Fit sheet before promote"
                      : "No committed drawing yet - draft on Fit sheet first"
                    : survey
                      ? `${survey.rows.length} QS lines on Fit sheet - promote when the BOM reads true`
                      : "Working drawing stays on the lot - QS anchors appear when ready"}
                </p>
              </div>
              <div className={css.btnRow}>
                {!progress.hasCad ? (
                  ghostCount > 0 ? (
                    <button
                      type="button"
                      className={`${css.btn} ${css.btnPrimary}`}
                      data-testid="quote-accept-ghosts"
                      disabled={pending}
                      onClick={() => {
                        setShowFitSheet(true);
                        acceptAllGhosts();
                      }}
                    >
                      Accept ({ghostCount}) →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${css.btn} ${css.btnPrimary}`}
                      data-testid="quote-open-fit-sheet"
                      onClick={() => {
                        setShowFitSheet(true);
                        setMode("cad");
                        setFitNonce((n) => n + 1);
                      }}
                    >
                      Draft on Fit sheet →
                    </button>
                  )
                ) : quotePersisted ? (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    onClick={() => setMode("share")}
                  >
                    Share with client →
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    disabled={pending}
                    onClick={() =>
                      run("Generating client quote…", async () => {
                        const res = await cadQuoteAction(projectId, "standard");
                        setBuild(res.build);
                        setSurvey(res.survey);
                        setQuoteHtml(res.html);
                        setShowQuoteOverlay(true);
                        if (res.output?.uri) {
                          setQuotePersisted(true);
                          setPortalLink(res.output.uri);
                        }
                        bumpOrchestration();
                        router.refresh();
                        return "Quote ready - Share when the client link is set";
                      })
                    }
                  >
                    Promote live BOM → quote
                  </button>
                )}
                <button
                  type="button"
                  className={`${css.btn}${walkMode ? ` ${css.btnPrimary}` : ""}`}
                  data-testid="quote-walk"
                  aria-pressed={walkMode}
                  title="Clay walkthrough · Esc exit"
                  onClick={() => setWalkMode((v) => !v)}
                >
                  {walkMode ? "Exit walk" : "Walk"}
                </button>
                <button
                  type="button"
                  className={css.btn}
                  aria-expanded={quoteToolsOpen}
                  onClick={() => setQuoteToolsOpen((v) => !v)}
                >
                  {quoteToolsOpen ? "Hide ledger" : "Ledger"}
                </button>
              </div>
              {quoteToolsOpen ? (
                <div className={`${css.btnRow} ${css.dockMore}`}>
                  <button
                    type="button"
                    className={`${css.btn} ${showFitSheet ? css.btnPrimary : ""}`}
                    aria-pressed={showFitSheet}
                    title="Paper working drawing (F)"
                    onClick={() => {
                      setShowFitSheet((v) => !v);
                      setFitNonce((n) => n + 1);
                    }}
                  >
                    Fit sheet
                  </button>
                  <button
                    type="button"
                    className={css.btn}
                    disabled={pending || !progress.hasCad}
                    onClick={() =>
                      run("Surveying…", async () => {
                        const res = await cadQuantitySurveyAction(projectId);
                        setSurvey(res.survey);
                        setSheet("qs");
                        return `${res.survey.rows.length} QS lines on Fit sheet`;
                      })
                    }
                  >
                    QS schedule
                  </button>
                  <button
                    type="button"
                    className={css.btn}
                    disabled={pending || !progress.hasCad}
                    onClick={() =>
                      run("Building schedule…", async () => {
                        const res = await cadBuildAction(projectId, "standard");
                        setBuild(res.build);
                        setSurvey(res.build.survey);
                        setSheet("build");
                        return `Build total $${res.build.total.toFixed(0)}`;
                      })
                    }
                  >
                    Build schedule
                  </button>
                  {tier1 ? (
                    <div
                      className={css.tier1Dock}
                      data-testid="canvas-tier1-quote"
                    >
                      <Tier1SavingsLedger variant="compact" />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className={`${css.status} ${error ? css.error : ""}`}>
                {error ??
                  status ??
                  (useGeoStage
                    ? showFitSheet
                      ? "Quote on Fit sheet — promote when the BOM reads true"
                      : "Vicmap lot is the sheet — Fit sheet for paper presentation"
                    : orchWorld
                      ? "Live estimate on the sheet — promote when it reads true"
                      : "Promote when the canvas reads true")}
              </div>
            </div>
          ) : null}

          {chrome.shareDock ? (
            <div
              className={`${css.shareSheet} ${css.shareSheetDock}${showFitSheet ? ` ${css.shareSheetPaper}` : ""}`}
              data-testid="canvas-share-sheet"
            >
              <p className={css.dockKicker}>Share</p>
              <p className={css.dockPrimaryHint}>
                {quotePersisted
                  ? "Copy the portal link — Fit sheet stays on the lot behind you."
                  : !progress.hasCad
                    ? "Verify CAD on Fit sheet, then promote a quote."
                    : "Promote quote on the Quote step, then come back to share."}
              </p>
              <div className={css.btnRow}>
                {!quotePersisted ? (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    data-testid="share-back-to-quote"
                    onClick={() => {
                      setShowFitSheet(true);
                      if (!progress.hasCad) setMode("cad");
                      else setMode("quote");
                    }}
                  >
                    {!progress.hasCad
                      ? "Open Fit sheet →"
                      : "Promote quote →"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    disabled={pending}
                    onClick={() =>
                      run("Copying portal link…", async () => {
                        const url = await copyPortalLinkAction(projectId);
                        setPortalLink(url);
                        await navigator.clipboard.writeText(url);
                      })
                    }
                  >
                    Copy portal link
                  </button>
                )}
                {portalLink || quotePersisted ? (
                  <a
                    className={css.btn}
                    href={portalLink ?? quoteUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open portal
                  </a>
                ) : null}
                <button
                  type="button"
                  className={`${css.btn}${walkMode ? ` ${css.btnPrimary}` : ""}`}
                  data-testid="share-walk"
                  aria-pressed={walkMode}
                  title="Clay walkthrough · Esc exit"
                  onClick={() => setWalkMode((v) => !v)}
                >
                  {walkMode ? "Exit walk" : "Walk"}
                </button>
                <button
                  type="button"
                  className={css.dockToggle}
                  onClick={() => setQuoteToolsOpen((v) => !v)}
                >
                  {quoteToolsOpen ? "Fewer" : "More"}
                </button>
              </div>
              {quoteToolsOpen ? (
                <div className={`${css.btnRow} ${css.dockMore}`}>
                  {quoteHtml ? (
                    <button
                      type="button"
                      className={css.btn}
                      onClick={() => setShowQuoteOverlay(true)}
                    >
                      View quote
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={css.btn}
                    aria-pressed={showFitSheet}
                    onClick={() => {
                      setShowFitSheet((v) => !v);
                      setFitNonce((n) => n + 1);
                    }}
                  >
                    Fit sheet
                  </button>
                  {tier1 ? (
                    <div
                      className={css.tier1Dock}
                      data-testid="canvas-tier1-share"
                    >
                      <Tier1SavingsLedger variant="compact" showTarget />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {portalLink ? (
                <p className={css.shareLink} title={portalLink}>
                  {portalLink}
                </p>
              ) : null}
              <div className={`${css.status} ${error ? css.error : ""}`}>
                {error ??
                  status ??
                  (quotePersisted
                    ? "Portal ready"
                    : "Quote unlocks the portal link")}
              </div>
            </div>
          ) : null}

          {showFitSheet && sheetElevations && useGeoStage ? (
            <SheetElevationPanel
              items={elevationItems}
              widthM={
                cadDoc?.width_m ?? boundary?.width_m ?? groundSpan?.widthM ?? 400
              }
            />
          ) : null}
        </>
      ) : null}

      {showQuoteOverlay && quoteHtml ? (
        <div className={css.quoteOverlay}>
          <div className={css.quoteBar}>
            <strong className={css.brand} style={{ fontSize: "1.25rem" }}>
              Client quote
            </strong>
            <div className={css.btnRow}>
              <button
                type="button"
                className={css.btn}
                onClick={() => window.print()}
              >
                Print / PDF
              </button>
              <button
                type="button"
                className={`${css.btn} ${css.btnPrimary}`}
                onClick={() => setShowQuoteOverlay(false)}
              >
                Back to canvas
              </button>
            </div>
          </div>
          <iframe
            className={css.quoteFrame}
            title="Quote preview"
            srcDoc={quoteHtml}
          />
        </div>
      ) : null}

      {sketch?.symbols ? (
        <CanvasStudioCommandPalette
          open={globalCommandOpen}
          onOpenChange={setGlobalCommandOpen}
          mode={mode}
          symbols={sketch.symbols}
          onMode={setMode}
          onToggleFitSheet={() => {
            setShowFitSheet((v) => !v);
            setFitNonce((n) => n + 1);
          }}
          fitSheetOn={showFitSheet}
          onToggleDarkCanvas={() => setDarkCanvas((v) => !v)}
          darkCanvas={darkCanvas}
          onToggleClientView={() => setClientView((v) => !v)}
          clientView={clientView}
          onScanGhosts={() => sketchCommandsRef.current?.scanGhosts()}
          onDraftCad={draftFitSheet}
          onGoToQuote={() => setMode("quote")}
          onToggleMeasure={() => setMeasureActive((v) => !v)}
          measureActive={measureActive}
          onToggleShade={() =>
            setViewLayers((prev) => ({ ...prev, shade: !prev.shade }))
          }
          onToggleEasements={() =>
            setViewLayers((prev) => ({ ...prev, easements: !prev.easements }))
          }
          shadeActive={viewLayers.shade}
          easementsActive={viewLayers.easements}
          projectId={projectId}
        />
      ) : null}
    </div>
  );
}

/** One-canvas operator surface — modes via ?mode= */
export function SiteCanvas(props: Props) {
  return (
    <Suspense fallback={<div className={css.root} data-testid="site-canvas" />}>
      <SiteCanvasInner {...props} />
    </Suspense>
  );
}
