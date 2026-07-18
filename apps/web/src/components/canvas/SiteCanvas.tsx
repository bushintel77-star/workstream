"use client";

import Link from "next/link";
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
import { isTier1WrightsTerrace } from "@workstream/domain";
import {
  acceptCadAction,
  autoTraceBoundaryAction,
  cadBuildAction,
  cadQuantitySurveyAction,
  cadQuoteAction,
  copyPortalLinkAction,
  downloadCadDxfAction,
  editCadAction,
  generateCadAction,
  lockBoundaryAction,
  resetBoundaryAction,
  runSurveyAction,
  saveBoundaryAction,
  unlockBoundaryAction,
} from "../../app/actions";
import { FirstRunGuide } from "./FirstRunGuide";
import { LiveBomHud } from "./LiveBomHud";
import type {
  CadBuildApi,
  CadDocumentLite,
  CadQuantitySurveyApi,
  SiteBoundaryLite,
} from "../../lib/canvas-types";
import type { DesignCanvas, RateCardItem } from "../../lib/api";
import {
  resolveCanvasMode,
  type CanvasMode,
} from "../../lib/canvas-mode";
import { onOrchestrationRefreshRequest } from "../../lib/canvas-mutation-bus";
import {
  displaySizeForAerial,
  fitWorldToStage,
  groundSpanMetres,
  resolveStaticMapView,
} from "../../lib/mapView";
import {
  BoundaryChrome,
  BoundaryOverlay,
  BoundaryStatusHud,
  type BoundaryTool,
} from "./BoundaryLockSnap";
import { CanvasModeStrip } from "./CanvasModeStrip";
import { SketchInstrument } from "./SketchInstrument";
import {
  DraftingHud,
  MeasureOverlay,
  measureDistanceMetres,
  type MeasurePt,
} from "./DraftingAssist";
import { TitleParcelOverlay } from "./TitleParcelOverlay";
import { SiteIntelligenceOverlay } from "./SiteIntelligenceOverlay";
import { SunShadeControls } from "./SunShadeControls";
import { Tier1SavingsLedger, Tier1ZoneCards } from "../tier1";
import { CanvasLayerToggles } from "./CanvasLayerToggles";
import css from "./siteCanvas.module.css";
import {
  DEFAULT_CANVAS_VIEW_LAYERS,
  type CanvasViewLayers,
} from "../../lib/canvas-view-layers";

export type SketchBundle = {
  aerialUri: string;
  lotRing: [number, number][];
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
  const [orchRefresh, setOrchRefresh] = useState(0);
  const [orchWorld, setOrchWorld] = useState<ProjectOrchestrationWorld | null>(
    null,
  );
  const [showGuide, setShowGuide] = useState(
    () => searchParams.get("guide") === "1",
  );
  const [viewLayers, setViewLayers] = useState<CanvasViewLayers>(
    DEFAULT_CANVAS_VIEW_LAYERS,
  );
  const [sunWhen, setSunWhen] = useState(() => new Date());
  const toggleViewLayer = useCallback((key: keyof CanvasViewLayers) => {
    setViewLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  const [sketchCount, setSketchCount] = useState(
    () => sketch?.canvas?.placements?.length ?? 0,
  );
  const [pending, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tier1 = isTier1WrightsTerrace(projectAddress);

  const committedCount =
    cadDoc?.entities.filter((e) => !e.ghost).length ?? 0;
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

  useEffect(() => {
    if (mode !== "cad") setShowCadAdvanced(false);
  }, [mode]);

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(40);
  const [ty, setTy] = useState(80);
  const [worldSize, setWorldSize] = useState({ width: 800, height: 480 });
  const [measureActive, setMeasureActive] = useState(false);
  const [measurePts, setMeasurePts] = useState<MeasurePt[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
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
      setCadDoc(result.document);
      setSvg(result.svg);
      setGhostCount(result.ghost_count);
      setError(null);
      setOrchRefresh((n) => n + 1);
    },
    [],
  );

  useEffect(() => {
    if (mode === "quote" && sheet === "none" && survey) setSheet("qs");
  }, [mode, sheet, survey]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!(e.target as HTMLElement)?.closest?.(`.${css.stage}`)) return;
      e.preventDefault();
      setScale((s) =>
        Math.min(3, Math.max(0.35, s * (e.deltaY > 0 ? 0.92 : 1.08))),
      );
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const persistBoundary = useCallback(
    (next: SiteBoundaryLite) => {
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
    applyFit();
  };

  const run = (label: string, fn: () => Promise<void>) => {
    setStatus(label);
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setStatus(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something failed");
        setStatus(null);
      }
    });
  };

  const chipStyle = (anchor: { x: number; y: number }) => {
    if (!cadDoc) return { left: "50%", top: "50%" };
    const left = `${(anchor.x / cadDoc.width_m) * 100}%`;
    const top = `${(1 - anchor.y / cadDoc.height_m) * 100}%`;
    return { left, top };
  };

  const showBoundary = mode === "survey" || mode === "cad";
  const showCadDock = mode === "cad";
  const showQuoteDock = mode === "quote";
  const showSurveyDock = mode === "survey";
  const showSketchDock = mode === "sketch" && Boolean(sketch);
  const showLiveBom =
    mode === "sketch" || mode === "cad" || mode === "quote";
  const showStage = mode !== "sketch" || Boolean(sketch);

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

  return (
    <div className={css.root} data-testid="site-canvas" data-canvas-mode={mode}>
      <CanvasModeStrip mode={mode} progress={progress} onMode={setMode} />

      {showGuide && aerialUri && committedCount === 0 ? (
        <FirstRunGuide
          projectId={projectId}
          onDismiss={() => {
            setShowGuide(false);
            clearGuideParam();
          }}
          onDone={(nextMode) => {
            setShowGuide(false);
            clearGuideParam();
            setMode(nextMode);
            bumpOrchestration();
            router.refresh();
          }}
        />
      ) : null}

      {showLiveBom ? (
        <LiveBomHud
          projectId={projectId}
          refreshKey={orchRefresh}
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

      {showStage ? (
        <>
          <div
            ref={stageRef}
            className={css.stage}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {viewLayers.draftGrid ? (
              <div
                className={css.draftGrid}
                aria-hidden
                data-testid="canvas-draft-grid"
              />
            ) : null}
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
              {mapView &&
              sketch?.surveyMetrics?.lat != null &&
              sketch.surveyMetrics.lng != null ? (
                <SiteIntelligenceOverlay
                  mapView={mapView}
                  lotRing={lotRing}
                  lat={sketch.surveyMetrics.lat}
                  lng={sketch.surveyMetrics.lng}
                  when={sunWhen}
                  showShade={viewLayers.shade}
                  showEasements={viewLayers.easements}
                />
              ) : null}
              {mapView && lotRing.length >= 3 && viewLayers.titleParcel ? (
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
                  showGhostSuggestions={viewLayers.ghostSuggestions}
                  measureActive={measureActive}
                  onToggleMeasure={() => {
                    setMeasureActive((on) => {
                      if (on) setMeasurePts([]);
                      return !on;
                    });
                  }}
                  onGoToQuote={() => setMode("quote")}
                  onDraftCad={() =>
                    run("Generating CAD…", async () => {
                      applyCad(await generateCadAction(projectId));
                      setMode("cad");
                    })
                  }
                  onToggleViewLayer={toggleViewLayer}
                  viewLayers={viewLayers}
                />
              ) : null}
              <MeasureOverlay
                mapView={mapView}
                worldWidthPx={worldSize.width}
                worldHeightPx={worldSize.height}
                active={measureActive}
                points={measurePts}
                onPointsChange={setMeasurePts}
              />
              {svg && (mode === "cad" || mode === "quote") ? (
                <div
                  className={`${css.cadLayer} ${ghostCount > 0 ? css.cadLayerGhost : ""}`}
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
                viewLayers.orchestrationChips &&
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

            {!cadDoc && !pending && mode === "cad" ? (
              <div className={css.emptyHint}>
                <strong>Design by CAD</strong>
                <p>Generate AI CAD on this site — live BOM updates as geometry lands.</p>
              </div>
            ) : null}
            {mode === "sketch" && sketchCount === 0 && !pending ? (
              <div className={css.emptyHint}>
                <strong>Paint the concept</strong>
                <p>
                  Pick a material below — stamp or drag to paint. Live BOM
                  updates as you go.
                </p>
              </div>
            ) : null}
          </div>

          <div className={css.topBar}>
            <div className={css.brandBlock}>
              <p className={css.brand}>Curtis &amp; Co</p>
              <p className={css.address}>{projectAddress}</p>
              <span className={css.badge}>
                {mode === "survey"
                  ? "Survey · boundary"
                  : mode === "sketch"
                    ? "Sketch · paint concept"
                    : mode === "quote"
                      ? "Quote · QS → build"
                      : mode === "share"
                        ? "Share · client link"
                        : "Working planning · indicative"}
              </span>
            </div>
          </div>

          <div className={css.rightRail} data-testid="canvas-right-rail">
            <div className={css.railActions}>
              <button type="button" className={css.iconBtn} onClick={fitSite}>
                Fit
              </button>
              <Link href="/" className={css.iconBtn}>
                Sites
              </Link>
            </div>

            {mapView && mode !== "share" ? (
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
                embedded
              />
            ) : null}

            {showBoundary && boundary ? (
              <BoundaryStatusHud boundary={boundary} embedded />
            ) : null}

            <CanvasLayerToggles layers={viewLayers} onChange={setViewLayers} />

            {viewLayers.shade &&
            sketch?.surveyMetrics?.lat != null &&
            sketch.surveyMetrics.lng != null ? (
              <SunShadeControls
                lat={sketch.surveyMetrics.lat}
                lng={sketch.surveyMetrics.lng}
                when={sunWhen}
                onWhenChange={setSunWhen}
              />
            ) : null}

            {(mode === "quote" || mode === "cad") &&
            sheet !== "none" &&
            (survey || build) ? (
              <aside className={css.sheet} aria-label="Schedule sheet">
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
          </div>

          <p className={css.honestyCaption} data-testid="canvas-honesty-caption">
            Concept sketch on aerial - indicative scale, not a construction drawing
          </p>

          {showBoundary ? (
            <BoundaryChrome
              boundary={boundary}
              tool={boundaryTool}
              pending={pending}
              onToolChange={setBoundaryTool}
              embeddedHud
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
            />
          ) : null}

          {showSurveyDock ? (
            <div className={css.dock}>
              <p className={css.dockPrimaryHint}>
                {aerialUri
                  ? "Site loaded — prepare the concept next"
                  : "Load the aerial for this address"}
              </p>
              <div className={css.btnRow}>
                {!aerialUri ? (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    disabled={pending}
                    onClick={() =>
                      run("Loading aerial & title…", async () => {
                        const fd = new FormData();
                        fd.set("projectId", projectId);
                        await runSurveyAction(fd);
                        try {
                          const res = await autoTraceBoundaryAction(projectId);
                          setBoundary(res.boundary);
                        } catch {
                          /* title overlay still renders from lotRing */
                        }
                        router.refresh();
                      })
                    }
                  >
                    Load site
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    onClick={() => {
                      setShowGuide(true);
                      setMode("sketch");
                    }}
                  >
                    Prepare this site →
                  </button>
                )}
              </div>
              <div className={`${css.status} ${error ? css.error : ""}`}>
                {error ??
                  status ??
                  (aerialUri
                    ? groundSpan
                      ? `Aerial fitted · frame ${groundSpan.widthM.toFixed(0)}×${groundSpan.heightM.toFixed(0)} m · title projected`
                      : "Aerial on canvas — title overlays when survey has a parcel"
                    : "Load aerial + land title onto the canvas")}
              </div>
            </div>
          ) : null}

          {showSketchDock ? (
            <div className={css.dock}>
              <p className={css.dockPrimaryHint}>
                {sketchCount === 0
                  ? "Accept AI suggestions or paint materials — live BOM tracks every stamp"
                  : "Concept on site — use ribbon or Ctrl+K for CAD and quote"}
              </p>
              <div className={`${css.status} ${error ? css.error : ""}`}>
                {error ??
                  status ??
                  (sketchCount > 0
                    ? `${sketchCount} placements · Alt+click to sample a brush`
                    : "Same world as Survey and CAD — Cmd+K for commands")}
              </div>
            </div>
          ) : null}

          {showCadDock ? (
            <div className={css.dock}>
              <p className={css.dockPrimaryHint}>
                {committedCount === 0
                  ? "AI can draft the working drawing on this aerial"
                  : ghostCount > 0
                    ? "Review AI suggestions — accept when they look right"
                    : "Drawing ready — live estimate is already updating"}
              </p>
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
                {committedCount === 0 ? (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    disabled={pending}
                    onClick={() =>
                      run("Generating CAD…", async () => {
                        applyCad(await generateCadAction(projectId));
                      })
                    }
                  >
                    Draft drawing
                  </button>
                ) : ghostCount > 0 ? (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    disabled={pending}
                    onClick={() =>
                      run("Accepting ghosts…", async () => {
                        applyCad(await acceptCadAction(projectId));
                      })
                    }
                  >
                    Accept suggestions ({ghostCount})
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    onClick={() => setMode("quote")}
                  >
                    Review price →
                  </button>
                )}
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
                  {committedCount > 0 ? (
                    <button
                      type="button"
                      className={css.btn}
                      disabled={pending}
                      onClick={() =>
                        run("Generating CAD…", async () => {
                          applyCad(await generateCadAction(projectId));
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
                    ? `${ghostCount} AI ghosts pending accept`
                    : committedCount > 0
                      ? `${committedCount} committed entities`
                      : "Generate unlocks Quote")}
              </div>
            </div>
          ) : null}

          {showQuoteDock ? (
            <div className={css.dock}>
              <p className={css.dockPrimaryHint}>
                {quotePersisted
                  ? "Client quote saved — share from this canvas"
                  : orchWorld && orchWorld.live_bom.length > 0
                    ? "Live BOM is already running — promote to client quote"
                    : "Generate client quote from CAD (live BOM stays on canvas)"}
              </p>
              {tier1 ? (
                <div className={css.tier1Dock} data-testid="canvas-tier1-quote">
                  <Tier1SavingsLedger variant="compact" />
                  <Tier1ZoneCards />
                </div>
              ) : null}
              <div className={css.btnRow}>
                {quotePersisted ? (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    onClick={() => setMode("share")}
                  >
                    Share →
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnPrimary}`}
                    disabled={pending || !progress.hasCad}
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
                      })
                    }
                  >
                    Promote live BOM → quote
                  </button>
                )}
                {quoteHtml ? (
                  <button
                    type="button"
                    className={css.btn}
                    onClick={() => setShowQuoteOverlay(true)}
                  >
                    Preview quote
                  </button>
                ) : null}
              </div>
              <div className={`${css.btnRow} ${css.dockMore}`}>
                <button
                  type="button"
                  className={css.btn}
                  disabled={pending || !progress.hasCad}
                  onClick={() =>
                    run("Surveying…", async () => {
                      const res = await cadQuantitySurveyAction(projectId);
                      setSurvey(res.survey);
                      setSheet("qs");
                    })
                  }
                >
                  View QS
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
                    })
                  }
                >
                  View build
                </button>
              </div>
              <div className={`${css.status} ${error ? css.error : ""}`}>
                {error ??
                  status ??
                  (tier1
                    ? "Tier-1 workbook total is the quote truth on this site"
                    : orchWorld
                      ? `Live BOM ${orchWorld.live_bom.length} lines · ${orchWorld.risks.length} risks`
                      : "Financials update as you draw — no separate quote mode")}
              </div>
            </div>
          ) : null}

          {mode === "share" ? (
            <div className={css.shareSheet} data-testid="canvas-share-sheet">
              <h2>Share with client</h2>
              <p>
                Copy the portal link or open the polished quote. Everything else
                stays on this canvas.
              </p>
              {tier1 ? (
                <div className={css.tier1Dock} data-testid="canvas-tier1-share">
                  <Tier1SavingsLedger variant="compact" showTarget />
                </div>
              ) : null}
              <div className={css.btnRow}>
                <button
                  type="button"
                  className={`${css.btn} ${css.btnPrimary}`}
                  disabled={pending || !quotePersisted}
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
                {quoteHtml ? (
                  <button
                    type="button"
                    className={css.btn}
                    onClick={() => setShowQuoteOverlay(true)}
                  >
                    View quote
                  </button>
                ) : (
                  <button
                    type="button"
                    className={css.btn}
                    onClick={() => setMode("quote")}
                  >
                    Make quote first
                  </button>
                )}
              </div>
              {portalLink ? (
                <p style={{ wordBreak: "break-all", fontSize: "0.75rem" }}>
                  {portalLink}
                </p>
              ) : null}
              <div className={`${css.status} ${error ? css.error : ""}`}>
                {error ?? status ?? "One click away from the client"}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {showQuoteOverlay && quoteHtml ? (
        <div className={css.quoteOverlay}>
          <div className={css.quoteBar}>
            <strong className={css.brand} style={{ fontSize: "1.25rem" }}>
              Polished quote
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
