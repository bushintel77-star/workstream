"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  BY_TYPE,
  MODE_TABS,
  type StudioItemType,
  type StudioMode,
} from "./studioCatalog";
import { useStudioState } from "./state/useStudioState";
import { resolveHandoffChrome } from "./state/handoffChrome";
import {
  allowAerialUnderlay,
  isDraftingPlate,
  resolveLiveAerial,
} from "./state/studioPlane";
import { CadPlanBoard } from "./features/cadPlan/CadPlanBoard";
import { FitSheetOverlay } from "./features/fitSheet/FitSheetOverlay";
import { AiGhostReview } from "./features/aiGhosts/AiGhostReview";
import { LayersPanel } from "./features/layers/LayersPanel";
import { StudioCommandPalette } from "./features/commandPalette/StudioCommandPalette";
import { SunGrowthDock } from "./features/sunGrowth/SunGrowthDock";
import { UtilityDrawer } from "./features/utilityDrawer/UtilityDrawer";
import { ComplianceTicker } from "./features/compliance/ComplianceTicker";
import { QuoteSurface } from "./features/tier1/QuoteSurface";
import { ElevationBoard } from "./features/elevation/ElevationBoard";
import {
  TraceOverlay,
  currentTraceCompletion,
} from "./features/trace/TraceOverlay";
import { MeasureOverlay } from "./features/measure/MeasureOverlay";
import { AerialSlot } from "./features/aerial/AerialSlot";
import { SketchBoard } from "./features/sketch/SketchBoard";
import { SurveyAnnotationLayer } from "./features/survey/SurveyAnnotationLayer";
import { SurveyChecklist } from "./features/survey/SurveyChecklist";
import { SiteSwitcher } from "./features/sites/SiteSwitcher";
import { AmbientRibbon } from "./features/ambient/AmbientRibbon";
import { SelectionRing } from "./features/selectionRing/SelectionRing";
import { PreemptiveHorizon } from "./features/horizon/PreemptiveHorizon";
import { HorizonMarkers } from "./features/horizon/HorizonMarkers";
import { ShareSurface } from "./features/share/ShareSurface";
import { FloraRing } from "./features/flora/FloraRing";
import { VolumetricIsolith } from "./features/isolith/VolumetricIsolith";
import { AmbientBudgetMargin } from "./features/trade/AmbientBudgetMargin";
import { TradeSkuTag } from "./features/trade/TradeSkuTag";
import { ITEM_LAYER } from "./state/studioTypes";
import { boardScaleM } from "./features/ground/groundMetrics";
import type { ArchitecturalTitleBlock } from "@workstream/domain";
import {
  solveLiveTradeEstimate,
  tradeTagForItem,
} from "@workstream/domain";
import type { CatalogPlacement, CanvasStroke } from "@workstream/contracts";
import {
  plotBoxFor,
  sheetBoxFor,
  titlePanelWidth,
} from "./geometry";
import { lookupCadastralTitleAction } from "../../../app/actions";
import css from "./handoffStudio.module.css";

type Props = {
  projectId: string;
  projectAddress: string;
  aerialUri?: string | null;
  areaM2?: number | null;
  initialMode?: StudioMode;
  initialPlacements?: CatalogPlacement[];
  initialStrokes?: CanvasStroke[];
  hasQuote?: boolean;
  quotePortalUri?: string | null;
  initialTitleBlock?: ArchitecturalTitleBlock | null;
};

/**
 * Design Studio v4/v5 shell — composes feature modules on `useStudioState`.
 * %‑coord aerial drafting board (not MapLibre / Vicmap title chrome).
 */
export function HandoffDesignStudio({
  projectId,
  projectAddress,
  aerialUri = null,
  areaM2 = 230.82,
  initialMode = "cad",
  initialPlacements = [],
  initialStrokes = [],
  hasQuote = false,
  quotePortalUri = null,
  initialTitleBlock = null,
}: Props) {
  const fallbackOutdoor = areaM2 ?? 230.82;
  const studio = useStudioState({
    projectId,
    address: projectAddress,
    aerialUri,
    outdoorM2: fallbackOutdoor,
    initialMode: MODE_TABS.includes(initialMode as StudioMode)
      ? initialMode
      : "cad",
    initialPlacements,
    initialStrokes,
  });
  const {
    ui,
    ai,
    compliance,
    estimate,
    estimateSettling,
    workableOutdoorM2,
    acceptHorizonCard,
  } = studio;
  /** Prefer Turf workable outdoor; fall back to project / seed area. */
  const outdoor = workableOutdoorM2 > 0 ? workableOutdoorM2 : fallbackOutdoor;
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ w: 960, h: 640 });
  const [quotePersisted, setQuotePersisted] = useState(hasQuote);
  const [portalUri, setPortalUri] = useState<string | null>(quotePortalUri);
  const [titleBlock, setTitleBlock] = useState<ArchitecturalTitleBlock | null>(
    initialTitleBlock,
  );

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setBoardSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    setBoardSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        studio.setUi({ cmdOpen: !ui.cmdOpen });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) studio.redo();
        else studio.undo();
        return;
      }
      if (typing || ui.cmdOpen) return;

      if (ui.tool === "trace" && ui.drawPoly) {
        if (e.key === "Tab") {
          const done = currentTraceCompletion(
            ui.drawPoly,
            ui.drawCursor,
            ui.locked,
          );
          if (done) {
            e.preventDefault();
            studio.finishTrace(done);
            return;
          }
        }
        if (e.key === "Enter" && ui.drawPoly.length >= 3) {
          e.preventDefault();
          studio.finishTrace(ui.drawPoly);
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          studio.popTracePoint();
          return;
        }
      }

      if (e.key === "Escape") {
        if (ui.floraSession) {
          studio.dismissFlora();
          return;
        }
        if (ui.drawPoly) {
          studio.cancelTrace();
          return;
        }
        studio.setUi({
          factorsOpen: false,
          ghostReviewOpen: false,
          layersOpen: false,
          cmdOpen: false,
          addOpen: false,
          sitesOpen: false,
          coachOpen: false,
        });
        return;
      }
      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        studio.setUi({ frameOn: !ui.frameOn });
        return;
      }
      if (
        (e.key.toLowerCase() === "a" || e.key === "Enter") &&
        ai.current &&
        !ui.drawPoly &&
        ui.tool !== "service" &&
        ui.tool !== "calib" &&
        ui.tool !== "level" &&
        ui.tool !== "trace"
      ) {
        e.preventDefault();
        ai.accept(ai.current.id);
        return;
      }
      if (e.key.toLowerCase() === "r" && ai.current && !ui.drawPoly) {
        e.preventDefault();
        ai.reject(ai.current.id);
        return;
      }
      if (
        !ui.selectedId &&
        !ui.drawPoly &&
        ai.pendingCount > 0 &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        ai.cycle(e.key === "ArrowRight" ? 1 : -1);
        return;
      }
      if (
        ui.selectedId &&
        !ui.drawPoly &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.2;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        studio.nudgeSelected(dx, dy);
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        ui.selectedId &&
        !ui.drawPoly
      ) {
        e.preventDefault();
        studio.deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio, ui]);

  useEffect(() => {
    setQuotePersisted(hasQuote);
    setPortalUri(quotePortalUri);
  }, [hasQuote, quotePortalUri]);

  const planOn =
    ui.mode !== "elevation" && ui.mode !== "quote" && ui.mode !== "share";
  const chrome = resolveHandoffChrome({
    mode: ui.mode,
    tool: ui.tool,
    focusOn: ui.focusOn,
    frameOn: ui.frameOn,
    clientView: ui.clientView,
    foundationCleanse: ui.foundationCleanse,
    pendingGhosts: ai.pendingCount,
  });
  const titleLocked =
    ui.foundationCleanse || ui.boundarySource === "vicmap";
  const drawingHot = chrome.collapseUtility;
  const showDocks = chrome.utilityDrawer;
  /** Draft AI surface only when chrome matrix allows (never Stage 1 / Fit). */
  const draftSurface = chrome.draftSurface;
  /** Prefer live project address; demo site switcher still re-queries Vicmap. */
  const displayAddress = studio.siteAddress || projectAddress;
  const scaleM = ui.boardWidthM ?? boardScaleM(ui.sheetScaleDenom);

  useEffect(() => {
    let cancelled = false;
    void lookupCadastralTitleAction(projectId, displayAddress)
      .then((block) => {
        if (!cancelled && block) setTitleBlock(block);
      })
      .catch(() => {
        /* keep last good title block */
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, displayAddress]);
  const draftingPlate = isDraftingPlate(ui.mode);
  const aerialOk = allowAerialUnderlay({
    mode: ui.mode,
    foundationCleanse: ui.foundationCleanse,
  });
  /** Single aerial paint path — Survey upload only; never CAD/Sketch/Stage 1. */
  const liveAerial = resolveLiveAerial({
    mode: ui.mode,
    foundationCleanse: ui.foundationCleanse,
    aerialSuppressed: ui.aerialSuppressed,
    aerialUri: ui.aerialUri,
  });
  const titleCueOnCad =
    (ui.foundationCleanse || titleLocked) && !ui.frameOn;
  const flaggedIds = new Set<string>(
    compliance.alerts.flatMap((a: { sourceIds: string[] }) => a.sourceIds),
  );

  const openHorizon = estimate.horizon.filter((h) => !ui.mitigated[h.id]);
  const actionHorizon = openHorizon.filter(
    (h) => h.kind === "drainage" || h.kind === "tpz" || h.kind === "engineer",
  );

  const trade = useMemo(
    () => solveLiveTradeEstimate({ report: estimate }),
    [estimate],
  );

  const tpzReadouts = compliance.alerts
    .filter((a) => a.code === "tpz")
    .map((a) => {
      const hardId = a.sourceIds.find((id) => {
        const it = studio.items.find((x) => x.id === id);
        return it && (it.t === "paving" || it.t === "deck");
      });
      const item = studio.items.find((x) => x.id === hardId);
      const pctMatch = a.title.match(/(\d+)%/);
      return {
        id: a.id,
        x: item?.x ?? 50,
        y: item?.y ?? 50,
        pct: pctMatch ? Number(pctMatch[1]) : 0,
        active: ui.hoverId === hardId || ui.selectedId === hardId,
      };
    });

  const layerChips = (
    [
      ["survey", "Survey"],
      ["boundary", "Boundary"],
      ["council", "Council"],
      ["vegetation", "Veg"],
    ] as const
  ).map(([key, label]) => ({
    key,
    label,
    count:
      key === "boundary"
        ? 2
        : studio.items.filter((i) => !i.ghost && ITEM_LAYER[i.t] === key)
            .length,
  }));

  const selectedLive =
    studio.items.find((i) => i.id === ui.selectedId && !i.ghost) ?? null;
  const selectedTradeTag =
    selectedLive && chrome.tradeMargin
      ? tradeTagForItem(trade, selectedLive.id)
      : null;

  useEffect(() => {
    if (!drawingHot) return;
    if (ui.utilityPanel != null || ui.coachOpen) {
      studio.setUi({ utilityPanel: null, coachOpen: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingHot]);

  const armType = (t: StudioItemType) => {
    studio.setUi({ armed: t, tool: "add", addOpen: true, cmdOpen: false });
  };

  const draftLabel =
    ai.status === "scanning"
      ? "Scanning"
      : ai.status === "assisting"
        ? "Assisting"
        : ai.pendingCount > 0
          ? `Review ${ai.pendingCount}`
          : "Ask AI";

  return (
    <div
      className={`${css.root}${ui.darkOn ? ` ${css.rootDark}` : ""}${ui.focusOn ? ` ${css.rootFocus}` : ""}${ui.clientView ? ` ${css.rootClient}` : ""}`}
      data-testid="handoff-design-studio"
      data-studio-surface="handoff-v4"
      data-compliance={compliance.canvasSignal}
      style={
        {
          ["--studio-zoom" as string]: String(ui.zoom),
        } as CSSProperties
      }
    >
      <header className={css.header} data-testid="canvas-studio-header">
        <div className={css.brandBlock}>
          <p className={css.brandName}>Curtis &amp; Co</p>
          <p className={css.address}>{displayAddress}</p>
        </div>

        <nav
          className={css.modes}
          aria-label="Design workflow"
          data-testid="canvas-mode-strip"
        >
          {MODE_TABS.map((m) => (
            <button
              key={m}
              type="button"
              className={`${css.modeBtn}${ui.mode === m ? ` ${css.modeBtnActive}` : ""}`}
              data-testid={`canvas-mode-${m}`}
              onClick={() => studio.setMode(m)}
            >
              {m[0]!.toUpperCase() + m.slice(1)}
            </button>
          ))}
        </nav>

        <div className={css.spacer} />

        {!ui.focusOn && !ui.clientView ? (
          <div className={css.meta} data-testid="header-cadastral-meta">
            {titleBlock?.metaLine ??
              `${studio.siteMeta} · ${Number(outdoor).toFixed(0)} m²`}
          </div>
        ) : null}

        {ui.frameOn && !ui.clientView ? (
          <div className={css.segment} data-testid="paper-size-control">
            {(["a3", "a4"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`${css.segmentBtn}${ui.paper === p ? ` ${css.segmentBtnActive}` : ""}`}
                onClick={() => studio.setPaper(p)}
              >
                {p.toUpperCase()}
              </button>
            ))}
            <button
              type="button"
              className={`${css.segmentBtn}${ui.sheetElevOn ? ` ${css.segmentBtnActive}` : ""}`}
              data-testid="sheet-elevations-toggle"
              onClick={() => studio.setUi({ sheetElevOn: !ui.sheetElevOn })}
              title="Elevations"
              aria-label="Elevations"
            >
              Elev
            </button>
          </div>
        ) : null}

        <div className={css.headerTools} role="toolbar" aria-label="Canvas tools">
          <button
            type="button"
            className={`${css.iconBtn}${ui.foundationCleanse ? ` ${css.iconBtnActive}` : ""}`}
            data-testid="title-boundary-top"
            aria-label={
              ui.foundationCleanse ? "Close title boundary" : "Title boundary"
            }
            title="Title boundary"
            onClick={() => {
              if (ui.foundationCleanse) studio.exitStage1Foundation();
              else void studio.runStage1FoundationCleanse();
            }}
          >
            <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2.5 3.5h11v9H2.5zM5 3.5v9M11 3.5v9M2.5 8h11"
                stroke="currentColor"
                strokeWidth="1.25"
              />
            </svg>
          </button>
          {ui.foundationCleanse || titleLocked ? (
            <button
              type="button"
              className={`${css.iconBtn}${ui.titleBoundaryLocked ? ` ${css.iconBtnActive}` : ""}`}
              data-testid="title-boundary-lock-top"
              aria-label={ui.titleBoundaryLocked ? "Unlock title" : "Lock title"}
              title={ui.titleBoundaryLocked ? "Unlock title" : "Lock title"}
              onClick={() =>
                studio.setTitleBoundaryLocked(!ui.titleBoundaryLocked)
              }
            >
              <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                <rect
                  x="3.5"
                  y="7"
                  width="9"
                  height="6.5"
                  rx="1.2"
                  stroke="currentColor"
                  strokeWidth="1.25"
                />
                <path
                  d={
                    ui.titleBoundaryLocked
                      ? "M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"
                      : "M5.5 7V5.2a2.5 2.5 0 0 1 4.8-.8"
                  }
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className={`${css.iconBtn}${ui.frameOn ? ` ${css.iconBtnActive}` : ""}`}
            data-testid="fit-sheet-top"
            aria-label="Fit sheet"
            title="Fit sheet"
            onClick={() => studio.setUi({ frameOn: !ui.frameOn })}
          >
            <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect
                x="3"
                y="2.5"
                width="10"
                height="11"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.25"
              />
              <path d="M9.5 2.5v11" stroke="currentColor" strokeWidth="1.25" />
            </svg>
          </button>
          {!ui.focusOn && !ui.clientView ? (
            <>
              <button
                type="button"
                className={`${css.iconBtn}${ui.darkOn ? ` ${css.iconBtnActive}` : ""}`}
                data-testid="dark-canvas-top"
                aria-label="Dark canvas"
                title="Dark canvas"
                onClick={() => studio.setUi({ darkOn: !ui.darkOn })}
              >
                <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M9.2 2.4A5.5 5.5 0 1 0 13.6 10 4.2 4.2 0 0 1 9.2 2.4z"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className={`${css.iconBtn}${ui.layersOpen ? ` ${css.iconBtnActive}` : ""}`}
                data-testid="canvas-layers-top"
                aria-label="Layers"
                title="Layers"
                onClick={() => studio.setUi({ layersOpen: !ui.layersOpen })}
              >
                <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M2.5 5.2 8 2.8l5.5 2.4L8 7.6 2.5 5.2zm0 3.2L8 11l5.5-2.6M2.5 11.6 8 14.2l5.5-2.6"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className={css.iconBtn}
                data-testid="canvas-sites-top"
                aria-label="Sites"
                title="Sites"
                onClick={() => studio.setUi({ sitesOpen: !ui.sitesOpen })}
              >
                <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M8 13.5s4-3.4 4-6.2A4 4 0 1 0 4 7.3C4 10.1 8 13.5 8 13.5z"
                    stroke="currentColor"
                    strokeWidth="1.25"
                  />
                  <circle cx="8" cy="7.2" r="1.3" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={`${css.iconBtn}${ui.focusOn ? ` ${css.iconBtnActive}` : ""}`}
            data-testid="canvas-focus-top"
            aria-label={ui.focusOn ? "Exit focus" : "Focus"}
            title={ui.focusOn ? "Exit focus" : "Focus"}
            onClick={() => studio.setUi({ focusOn: !ui.focusOn })}
          >
            <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.25" />
              <path
                d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
          </button>
          {!ui.focusOn ? (
            <button
              type="button"
              className={`${css.iconBtn}${ui.clientView ? ` ${css.iconBtnActive}` : ""}`}
              data-testid="client-view-top"
              aria-label="Client view"
              title="Client view"
              onClick={() =>
                studio.setUi({
                  clientView: !ui.clientView,
                  focusOn: !ui.clientView,
                  ghostReviewOpen: false,
                })
              }
            >
              <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M2.5 8s2.2-3.5 5.5-3.5S13.5 8 13.5 8s-2.2 3.5-5.5 3.5S2.5 8 2.5 8z"
                  stroke="currentColor"
                  strokeWidth="1.25"
                />
                <circle cx="8" cy="8" r="1.4" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          ) : null}
          {!ui.focusOn && !ui.clientView ? (
            <button
              type="button"
              className={`${css.iconBtn}${ui.mode === "share" ? ` ${css.iconBtnActive}` : ""}`}
              data-testid="share-top"
              aria-label="Share"
              title="Share"
              onClick={() => studio.setMode("share")}
            >
              <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="12" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="4" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="12" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M5.4 7.3 10.5 4.8M5.4 8.7l5.1 2.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className={css.cmdBtn}
            data-testid="canvas-command-top"
            onClick={() => studio.setUi({ cmdOpen: true })}
            title="Command palette"
          >
            ⌘K
          </button>
          {!ui.clientView && !ui.foundationCleanse && !ui.frameOn ? (
            <button
              type="button"
              className={`${css.aiPill}${ai.pendingCount > 0 ? ` ${css.aiPillHot}` : ""}${ai.status === "verified" && ai.pendingCount === 0 ? ` ${css.aiPillOk}` : ""}`}
              data-testid="header-accept-ghosts"
              onClick={() => {
                if (ai.status === "scanning" || ai.status === "assisting") {
                  studio.setUi({ cmdOpen: true, cmdQuery: "" });
                  return;
                }
                if (ai.pendingCount === 0) {
                  void ai.scan();
                  return;
                }
                studio.setUi({ ghostReviewOpen: true });
              }}
            >
              {draftLabel}
            </button>
          ) : null}
          <span
            className={`${css.savedTick}${ui.saveStatus === "saving" ? ` ${css.savedTickPulse}` : ""}`}
            data-testid="autosave-tick"
            data-status={ui.saveStatus}
          >
            {ui.saveStatus === "saving"
              ? "Saving"
              : ui.saveStatus === "error"
                ? "Retry"
                : ui.saveStatus === "saved"
                  ? "Saved"
                  : ""}
          </span>
        </div>
      </header>

      <div
        className={`${css.board}${compliance.canvasSignal === "critical" ? ` ${css.boardCritical}` : ""}${compliance.canvasSignal === "watch" ? ` ${css.boardWatch}` : ""}`}
        data-testid="studio-board"
        ref={boardRef}
      >
        {ui.mode === "elevation" ? (
          <ElevationBoard
            axis={ui.elevAxis}
            boundary={studio.boundary}
            building={studio.building}
            items={studio.items}
            selectedId={ui.selectedId}
            onSelect={(id) => studio.setUi({ selectedId: id })}
            onToggleAxis={() =>
              studio.setUi({ elevAxis: ui.elevAxis === "x" ? "y" : "x" })
            }
            onTraceInPlan={(id) => {
              studio.setUi({ selectedId: id });
              studio.setMode("cad");
            }}
          />
        ) : null}

        {ui.mode === "quote" ? (
          <QuoteSurface
            address={displayAddress}
            estimate={estimate}
            draftUnverified={ai.status === "unverified"}
            pendingGhosts={ai.pendingCount}
            onReviewGhosts={() => {
              studio.setMode("cad");
              ai.openReview();
            }}
            onShare={() => studio.setMode("share")}
            onBack={() => studio.setMode("cad")}
          />
        ) : null}

        {ui.mode === "share" ? (
          <ShareSurface
            projectId={projectId}
            draftUnverified={ai.status === "unverified"}
            pendingGhosts={ai.pendingCount}
            quotePersisted={quotePersisted}
            portalUri={portalUri}
            onQuotePersisted={(uri) => {
              setQuotePersisted(true);
              setPortalUri(uri);
            }}
            onReviewGhosts={() => {
              studio.setMode("cad");
              ai.openReview();
            }}
            onBack={() => studio.setMode("cad")}
          />
        ) : null}

        {planOn ? (
          <div
            className={`${css.zoomWorld}${ui.frameOn ? ` ${css.zoomWorldClipped}` : ""}`}
            style={{
              transform: `scale(${ui.zoom})`,
              ...(ui.frameOn
                ? (() => {
                    const sheet = sheetBoxFor(
                      boardSize.w,
                      boardSize.h,
                      ui.paper,
                    );
                    const titleW = titlePanelWidth(sheet.boxW);
                    const elevH = ui.sheetElevOn ? 56 * 2 + 34 : 0;
                    const plot = plotBoxFor(sheet, { titleW, elevH });
                    return {
                      clipPath: `inset(${plot.boxTop}px ${Math.max(0, boardSize.w - plot.boxLeft - plot.boxW)}px ${Math.max(0, boardSize.h - plot.boxTop - plot.boxH)}px ${plot.boxLeft}px)`,
                    };
                  })()
                : null),
            }}
          >
            <AerialSlot
              uri={liveAerial}
              dimmed={ui.darkOn}
              frameOn={ui.frameOn}
              scanning={
                aerialOk &&
                (ui.canopyScanning || ai.busy === "scanning")
              }
              zoom={ui.zoom}
              sheetScaleDenom={ui.sheetScaleDenom}
              darkOn={ui.darkOn}
              foundationCleanse={ui.foundationCleanse}
              allowAerial={aerialOk}
              autoCanopyScan={false}
              titleLocked={titleLocked}
              boundarySource={ui.boundarySource}
              siteLabel={displayAddress}
              address={displayAddress}
              suppressSiteCue={titleCueOnCad}
              parchmentPeel={
                draftingPlate || ui.foundationCleanse ? 1 : ui.parchmentPeel
              }
              onUri={(uri) => {
                if (!aerialOk) return;
                studio.setUi({
                  aerialUri: uri,
                  aerialSuppressed: uri == null,
                });
              }}
              onScanning={(canopyScanning) => studio.setUi({ canopyScanning })}
              onCanopyImage={ai.ingestCanopyImage}
            />
            <CadPlanBoard
              frameOn={ui.frameOn}
              darkOn={ui.darkOn}
              foundationCleanse={ui.foundationCleanse}
              titleLocked={titleLocked}
              titleBoundaryLocked={ui.titleBoundaryLocked}
              scaleM={scaleM}
              lotAreaM2={titleBlock?.lotAreaM2 ?? outdoor}
              siteLabel={displayAddress}
              titleMeta={
                titleBlock
                  ? {
                      parcelRef: titleBlock.parcelRef,
                      sourceLabel: titleBlock.sourceLabel,
                      councilLabel: titleBlock.councilLabel,
                      sourceKind: titleBlock.sourceKind,
                    }
                  : null
              }
              boundary={studio.boundary}
              building={studio.building}
              items={studio.items}
              mode={ui.mode}
              tool={ui.foundationCleanse && !ui.titleBoundaryLocked ? "edit" : ui.tool}
              locked={ui.foundationCleanse ? false : ui.locked}
              layerOpacity={ui.layerOpacity}
              setbackOn={ui.setbackOn}
              growth={ui.growth}
              selectedId={ui.selectedId}
              groupIds={ui.groupIds}
              hoverId={ui.hoverId}
              curGhostId={ai.current?.id ?? null}
              reviewOpen={ui.ghostReviewOpen}
              flaggedIds={flaggedIds}
              tpzReadouts={tpzReadouts}
              onSelect={(id, opts) => {
                if (!id) {
                  studio.setSelection(null, []);
                  return;
                }
                if (ai.pending.some((g) => g.id === id)) {
                  const idx = ai.pending.findIndex((g) => g.id === id);
                  studio.setUi({
                    selectedId: id,
                    groupIds: [],
                    ghostIdx: idx >= 0 ? idx : ui.ghostIdx,
                    ghostReviewOpen: true,
                  });
                  return;
                }
                if (opts?.additive) {
                  const next = ui.groupIds.includes(id)
                    ? ui.groupIds.filter((g) => g !== id)
                    : [...ui.groupIds, id];
                  studio.setSelection(id, next.length ? next : [id]);
                  return;
                }
                studio.setSelection(id, [id]);
              }}
              onMarqueeSelect={(ids) => {
                studio.setSelection(ids[0] ?? null, ids);
              }}
              onHover={(id) => studio.setUi({ hoverId: id })}
              onAcceptGhost={ai.accept}
              onRejectGhost={ai.reject}
              onTraceInElevation={(id) => {
                studio.setSelection(id, [id]);
                studio.setMode("elevation");
              }}
              onBoundaryChange={studio.updateBoundary}
              onBuildingChange={studio.updateBuilding}
              onPlace={studio.placeArmed}
              onMoveItem={studio.moveItem}
              onMoveGroup={studio.moveGroup}
              onTransformItem={studio.transformItem}
            />
            {chrome.floraRing && ui.floraSession ? (
              <FloraRing
                xPct={ui.floraSession.x}
                yPct={ui.floraSession.y}
                candidates={ui.floraSession.candidates}
                activeIdx={ui.floraSession.activeIdx}
                previewSpreadPct={Math.min(
                  28,
                  Math.max(
                    6,
                    (ui.floraSession.candidates[ui.floraSession.activeIdx]
                      ?.canopySpreadM ?? 2) * 2.4,
                  ),
                )}
                onActiveIdx={studio.setFloraActiveIdx}
                onAccept={studio.acceptFlora}
                onDismiss={studio.dismissFlora}
              />
            ) : null}
            {chrome.horizon ? (
              <HorizonMarkers
                cards={actionHorizon}
                onFocus={(card) => {
                  if (card.suggestType) {
                    acceptHorizonCard(card);
                    return;
                  }
                  studio.setUi({
                    utilityPanel: "bom",
                  });
                }}
              />
            ) : null}
            {chrome.volumeIsolith ? (
              <VolumetricIsolith
                estimate={estimate}
                proximity={
                  drawingHot &&
                  (ui.armed === "paving" ||
                    ui.armed === "deck" ||
                    ui.tool === "edit")
                }
              />
            ) : null}
            {ui.mode === "sketch" ? (
              <SketchBoard
                strokes={studio.strokes}
                darkOn={ui.darkOn}
                onCommit={(stroke) => {
                  studio.setStrokes([...studio.strokes, stroke]);
                }}
                onConvertToCad={() => {
                  studio.interpretSketches();
                }}
              />
            ) : null}
            {ui.mode === "survey" && !ui.frameOn ? (
              <>
                <SurveyAnnotationLayer
                  active
                  tool={ui.tool}
                  levels={studio.levels}
                  services={studio.services}
                  scaleM={scaleM}
                  darkOn={ui.darkOn}
                  layerOpacity={ui.layerOpacity}
                  onAddLevel={studio.addSpotLevel}
                  onCommitService={studio.commitService}
                  onCalibrate={(nextScaleM) => {
                    // Prototype: board width metres from two known points.
                    // Also snap sheet denom so the ground mesh stays coherent.
                    const denoms = [50, 100, 200, 250, 500] as const;
                    const target = (nextScaleM / 110) * 100;
                    let best: (typeof denoms)[number] = 100;
                    let bestD = Infinity;
                    for (const d of denoms) {
                      const err = Math.abs(d - target);
                      if (err < bestD) {
                        bestD = err;
                        best = d;
                      }
                    }
                    studio.setUi({
                      boardWidthM: nextScaleM,
                      sheetScaleDenom: best,
                      tool: "pan",
                    });
                  }}
                />
                {!ui.focusOn && !ui.clientView ? (
                  <SurveyChecklist
                    boundary={studio.boundary}
                    building={studio.building}
                    items={studio.items}
                    levels={studio.levels}
                    services={studio.services}
                  />
                ) : null}
              </>
            ) : null}
            <TraceOverlay
              active={ui.tool === "trace" && !ui.frameOn && ui.mode !== "sketch"}
              locked={ui.locked}
              target={ui.traceTarget}
              drawPoly={ui.drawPoly}
              drawCursor={ui.drawCursor}
              onTarget={studio.setTraceTarget}
              onCursor={(drawCursor) => studio.setUi({ drawCursor })}
              onPush={studio.pushTracePoint}
              onFinish={studio.finishTrace}
              onCancel={studio.cancelTrace}
              onPop={studio.popTracePoint}
            />
            <MeasureOverlay active={ui.tool === "measure" && !ui.frameOn} />
            {chrome.selectionRing && selectedLive ? (
              <SelectionRing
                item={selectedLive}
                xPct={selectedLive.x}
                yPct={selectedLive.y}
                locked={ui.locked}
                onMaterial={studio.changeSelectedType}
                onOpacityPeel={() => {
                  const bucket = ITEM_LAYER[selectedLive.t];
                  const cur = ui.layerOpacity[bucket];
                  studio.setLayerOpacity(bucket, cur < 0.4 ? 1 : 0.25);
                }}
                onParchmentPeel={
                  liveAerial
                    ? () => {
                        const steps = [0.12, 0.28, 0.42, 0.62, 0.85];
                        const idx = steps.findIndex(
                          (s) => Math.abs(s - ui.parchmentPeel) < 0.05,
                        );
                        const next = steps[(idx + 1) % steps.length]!;
                        studio.setUi({ parchmentPeel: next });
                      }
                    : undefined
                }
                onToggleLock={() => studio.setTool(ui.locked ? "pan" : "lock")}
                onDelete={studio.deleteSelected}
                onClose={() => studio.setSelection(null, [])}
              />
            ) : null}
            {chrome.tradeMargin && selectedTradeTag && selectedLive ? (
              <TradeSkuTag
                match={selectedTradeTag}
                xPct={selectedLive.x}
                yPct={selectedLive.y}
              />
            ) : null}
            {chrome.tradeMargin ? (
              <AmbientBudgetMargin
                trade={trade}
                displayTotalInclGst={estimate.totalInclGst}
              />
            ) : null}
          </div>
        ) : null}

        {ui.frameOn && planOn ? (
          <FitSheetOverlay
            boardW={boardSize.w}
            boardH={boardSize.h}
            paper={ui.paper}
            address={displayAddress}
            boundary={studio.boundary}
            building={studio.building}
            items={studio.items}
            easements={studio.easements}
            services={studio.services}
            showElevations={ui.sheetElevOn}
            scaleDenom={ui.sheetScaleDenom}
            onScaleDenom={(sheetScaleDenom) => studio.setUi({ sheetScaleDenom })}
            titleBlock={titleBlock}
          />
        ) : null}

        {chrome.ambientRibbon ? (
          <AmbientRibbon
            tool={ui.tool}
            mode={ui.mode}
            locked={ui.locked}
            canUndo={studio.canUndo}
            canRedo={studio.canRedo}
            layerChips={layerChips}
            layerOpacity={ui.layerOpacity}
            parchmentPeel={ui.parchmentPeel}
            hasAerial={Boolean(liveAerial)}
            onTool={studio.setTool}
            onMeasure={() =>
              studio.setTool(ui.tool === "measure" ? "pan" : "measure")
            }
            onUndo={studio.undo}
            onRedo={studio.redo}
            onZoom={(delta) => {
              if (ui.foundationCleanse) return;
              studio.setUi({
                zoom: Math.max(
                  0.6,
                  Math.min(2.2, Number((ui.zoom + delta).toFixed(2))),
                ),
              });
            }}
            onFit={() => {
              if (ui.foundationCleanse) {
                studio.setUi({ zoom: 1, sheetScaleDenom: 100 });
                return;
              }
              studio.setUi({ zoom: 1 });
            }}
            onOpacity={studio.setLayerOpacity}
            onParchmentPeel={(parchmentPeel) => studio.setUi({ parchmentPeel })}
          />
        ) : null}


        {ui.addOpen && planOn && !ui.focusOn && ui.mode !== "sketch" ? (
          <div className={css.addStrip} data-testid="add-symbol-strip">
            {(Object.keys(BY_TYPE) as StudioItemType[])
              .filter((t) =>
                ui.mode === "survey"
                  ? Boolean(BY_TYPE[t].existing)
                  : !BY_TYPE[t].existing,
              )
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${css.chip}${ui.armed === t ? ` ${css.chipActive}` : ""}`}
                  onClick={() => armType(t)}
                >
                  {BY_TYPE[t].tag}
                </button>
              ))}
          </div>
        ) : null}

        {showDocks ? (
          <>
            <UtilityDrawer
              openPanel={ui.utilityPanel}
              collapsed={drawingHot}
              outdoorM2={outdoor}
              boundary={studio.boundary}
              items={studio.items}
              estimate={estimate}
              mitigated={ui.mitigated}
              complianceSignal={compliance.canvasSignal}
              compliancePass={
                [compliance.outdoorOk, compliance.permeableOk, compliance.canopyOk].filter(
                  Boolean,
                ).length
              }
              onOpenPanel={(utilityPanel) => studio.setUi({ utilityPanel })}
              onMitigate={(id) =>
                studio.setUi({
                  mitigated: { ...ui.mitigated, [id]: !ui.mitigated[id] },
                })
              }
              onOpenQuote={() => studio.setMode("quote")}
              settling={estimateSettling || ui.saveStatus === "saving"}
            />
            {chrome.sunGrowth ? (
              <SunGrowthDock
                sunMin={ui.sunMin}
                growth={ui.growth}
                playing={ui.sunPlay}
                onSunMin={(sunMin) => studio.setUi({ sunMin })}
                onGrowth={(growth) => studio.setUi({ growth })}
                onPlaying={(sunPlay) => studio.setUi({ sunPlay })}
              />
            ) : null}
            <ComplianceTicker
              report={compliance}
              onOpenCompliance={() =>
                studio.setUi({ utilityPanel: "compliance", setbackOn: true })
              }
            />
            {chrome.horizon ? (
              <PreemptiveHorizon
                cards={actionHorizon}
                onAccept={acceptHorizonCard}
                onDismiss={(id) =>
                  studio.setUi({
                    mitigated: { ...ui.mitigated, [id]: true },
                  })
                }
              />
            ) : null}
          </>
        ) : null}

        {draftSurface && ui.councilTip ? (
          <div className={css.councilTip} data-testid="council-setback-tip">
            {ui.councilTip}
          </div>
        ) : null}

        {draftSurface && ui.ghostReviewOpen ? (
          <div className={css.ghostPanel}>
            <AiGhostReview
              ghosts={ai.pending}
              items={studio.items}
              boundary={studio.boundary}
              building={studio.building}
              scaleM={scaleM}
              sunMin={ui.sunMin}
              growth={ui.growth}
              selectedId={ai.current?.id ?? null}
              factorsOpen={ui.factorsOpen}
              onFactorsOpen={(factorsOpen) => studio.setUi({ factorsOpen })}
              onSelect={(id) => {
                const idx = ai.pending.findIndex((g) => g.id === id);
                studio.setUi({ ghostIdx: idx >= 0 ? idx : ui.ghostIdx });
              }}
              onAccept={ai.accept}
              onReject={ai.reject}
              onCycle={ai.cycle}
              onAskAi={(id) => {
                const g = ai.pending.find((x) => x.id === id);
                void ai.assist(g?.why ?? "refine this suggestion");
              }}
            />
          </div>
        ) : null}

        <LayersPanel
          open={ui.layersOpen}
          opacity={ui.layerOpacity}
          setbackOn={ui.setbackOn}
          items={studio.items}
          onClose={() => studio.setUi({ layersOpen: false })}
          onOpacity={studio.setLayerOpacity}
          onSetback={(setbackOn) => studio.setUi({ setbackOn })}
        />

        <SiteSwitcher
          open={ui.sitesOpen}
          siteIdx={ui.siteIdx}
          onClose={() => studio.setUi({ sitesOpen: false })}
          onPick={studio.switchSite}
        />

        <StudioCommandPalette
          open={ui.cmdOpen}
          query={ui.cmdQuery}
          onQuery={(cmdQuery) => studio.setUi({ cmdQuery })}
          onClose={() => studio.setUi({ cmdOpen: false, cmdQuery: "" })}
          onAskAi={(q) => void ai.assist(q)}
          onArm={armType}
          onScanGhosts={() => void ai.scan()}
          onConvertSketch={() => studio.interpretSketches()}
          onToggleFitSheet={() => studio.setUi({ frameOn: !ui.frameOn })}
          onGoQuote={() => studio.setMode("quote")}
          onToggleFocus={() => studio.setUi({ focusOn: !ui.focusOn })}
          onUndo={studio.undo}
          onRedo={studio.redo}
        />

      </div>
    </div>
  );
}
