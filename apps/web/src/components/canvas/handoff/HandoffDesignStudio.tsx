"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  BY_TYPE,
  MODE_TABS,
  type StudioItemType,
  type StudioMode,
} from "./studioCatalog";
import { useStudioState } from "./state/useStudioState";
import { resolveHandoffChrome } from "./state/handoffChrome";
import { CadPlanBoard } from "./features/cadPlan/CadPlanBoard";
import { FitSheetOverlay } from "./features/fitSheet/FitSheetOverlay";
import { AiGhostReview } from "./features/aiGhosts/AiGhostReview";
import { AiCoachDock } from "./features/aiGhosts/AiCoachDock";
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
import { SiteSwitcher } from "./features/sites/SiteSwitcher";
import { StudioCoachMarks } from "./features/coach/StudioCoachMarks";
import { AmbientRibbon } from "./features/ambient/AmbientRibbon";
import { SelectionRing } from "./features/selectionRing/SelectionRing";
import { PreemptiveHorizon } from "./features/horizon/PreemptiveHorizon";
import { HorizonMarkers } from "./features/horizon/HorizonMarkers";
import { ShareSurface } from "./features/share/ShareSurface";
import { ITEM_LAYER } from "./state/studioTypes";
import type {
  ArchitecturalTitleBlock,
  StudioAiSuggestion,
} from "@workstream/domain";
import type { CatalogPlacement, CanvasStroke } from "@workstream/contracts";
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
  const outdoor = areaM2 ?? 230.82;
  const studio = useStudioState({
    projectId,
    address: projectAddress,
    aerialUri,
    outdoorM2: outdoor,
    initialMode: MODE_TABS.includes(initialMode as StudioMode)
      ? initialMode
      : "cad",
    initialPlacements,
    initialStrokes,
  });
  const { ui, ai, compliance, estimate, acceptHorizonCard } = studio;
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
      if (e.key.toLowerCase() === "a" && ai.current && !ui.drawPoly) {
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
  });
  const drawingHot = chrome.collapseUtility;
  const showDocks = chrome.utilityDrawer;
  /** Fit sheet / focus freezes floating chrome — parchment plane stays first. */
  const chromeLive = planOn && !ui.frameOn && !ui.focusOn && !ui.clientView;
  /** Prefer live project address; demo site switcher still re-queries Vicmap. */
  const displayAddress = studio.siteAddress || projectAddress;

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
  const liveAerial = ui.aerialUri ?? aerialUri;
  const flaggedIds = new Set<string>(
    compliance.alerts.flatMap((a: { sourceIds: string[] }) => a.sourceIds),
  );

  const openHorizon = estimate.horizon.filter((h) => !ui.mitigated[h.id]);
  const actionHorizon = openHorizon.filter(
    (h) => h.kind === "drainage" || h.kind === "tpz" || h.kind === "engineer",
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

  useEffect(() => {
    if (!drawingHot) return;
    if (ui.utilityPanel != null || ui.coachOpen) {
      studio.setUi({ utilityPanel: null, coachOpen: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingHot]);

  useEffect(() => {
    if (compliance.alerts.some((a) => a.code === "setback" || a.code === "tpz")) {
      if (!ui.setbackOn) studio.setUi({ setbackOn: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compliance.alerts]);

  const armType = (t: StudioItemType) => {
    studio.setUi({ armed: t, tool: "add", addOpen: true, cmdOpen: false });
  };

  const draftLabel =
    ai.status === "scanning"
      ? "AI DRAFT: SCANNING"
      : ai.status === "assisting"
        ? "AI DRAFT: ASSISTING"
        : ai.status === "unverified"
          ? "AI DRAFT: UNVERIFIED"
          : "AI DRAFT: VERIFIED";

  const onCoachTip = (tip: StudioAiSuggestion) => {
    if (tip.id === "review-ghosts" || tip.id === "scan-site") {
      if (tip.id === "scan-site") void ai.scan();
      else ai.openReview();
      return;
    }
    if (tip.action === "quote") {
      studio.setMode("quote");
      return;
    }
    if (tip.action === "place" || tip.action === "cad") {
      studio.setUi({ addOpen: true, tool: "add", coachOpen: true });
      return;
    }
    if (tip.action === "trp") {
      armType("exist");
      return;
    }
    ai.openReview();
  };

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
        <div>
          <p className={css.brandName}>Curtis &amp; Co</p>
          <p className={css.address}>{displayAddress}</p>
        </div>
        <div className={css.spacer} />
        <nav className={css.modes} aria-label="Design workflow" data-testid="canvas-mode-strip">
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
        <div className={css.meta}>
          <div className={css.metaEyebrow}>Working drawing</div>
          <div className={css.metaDetail} data-testid="header-cadastral-meta">
            {titleBlock?.metaLine ??
              `${studio.siteMeta} · ${Number(outdoor).toFixed(0)} m²`}
          </div>
        </div>

        {ui.frameOn ? (
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
              title="Stacked elevations on Fit sheet"
            >
              {ui.sheetElevOn ? "Elevations ✓" : "+ Elevations"}
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className={`${css.toolBtn}${ui.frameOn ? ` ${css.toolBtnActive}` : ""}`}
          data-testid="fit-sheet-top"
          onClick={() => studio.setUi({ frameOn: !ui.frameOn })}
        >
          Fit sheet
        </button>
        <button
          type="button"
          className={`${css.toolBtn}${ui.darkOn ? ` ${css.toolBtnActive}` : ""}`}
          data-testid="dark-canvas-top"
          onClick={() => studio.setUi({ darkOn: !ui.darkOn })}
        >
          {ui.darkOn ? "Dark on" : "Dark"}
        </button>
        <button
          type="button"
          className={`${css.toolBtn}${ui.layersOpen ? ` ${css.toolBtnActive}` : ""}`}
          data-testid="canvas-layers-top"
          onClick={() => studio.setUi({ layersOpen: !ui.layersOpen })}
        >
          Layers
        </button>
        <button
          type="button"
          className={css.toolBtn}
          data-testid="canvas-sites-top"
          onClick={() => studio.setUi({ sitesOpen: !ui.sitesOpen })}
        >
          Sites
        </button>
        <button
          type="button"
          className={`${css.toolBtn}${ui.focusOn ? ` ${css.toolBtnActive}` : ""}`}
          data-testid="canvas-focus-top"
          onClick={() => studio.setUi({ focusOn: !ui.focusOn })}
        >
          {ui.focusOn ? "Exit focus" : "Focus"}
        </button>
        <button
          type="button"
          className={`${css.toolBtn}${ui.clientView ? ` ${css.toolBtnActive}` : ""}`}
          data-testid="client-view-top"
          onClick={() =>
            studio.setUi({
              clientView: !ui.clientView,
              focusOn: !ui.clientView,
              ghostReviewOpen: false,
            })
          }
        >
          Client view
        </button>
        <button
          type="button"
          className={`${css.toolBtn}${ui.mode === "share" ? ` ${css.toolBtnActive}` : ""}`}
          data-testid="share-top"
          onClick={() => studio.setMode("share")}
        >
          Share
        </button>
        <button
          type="button"
          className={css.cmdBtn}
          data-testid="canvas-command-top"
          onClick={() => studio.setUi({ cmdOpen: true })}
        >
          ⌘K
        </button>
        {!ui.clientView ? (
          <button
            type="button"
            className={`${css.aiPill}${ai.status === "verified" ? ` ${css.aiPillOk}` : ""}`}
            data-testid="header-accept-ghosts"
            onClick={() => {
              if (ai.status === "scanning" || ai.status === "assisting") {
                studio.setUi({ coachOpen: true });
                return;
              }
              if (ai.pendingCount === 0) {
                void ai.scan();
                return;
              }
              ai.acceptAll();
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
            ? "Saving…"
            : ui.saveStatus === "error"
              ? "Save failed"
              : ui.saveStatus === "saved"
                ? "Saved"
                : "—"}
        </span>
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
            className={css.zoomWorld}
            style={{ transform: `scale(${ui.zoom})` }}
          >
            <AerialSlot
              uri={liveAerial}
              dimmed={ui.darkOn}
              frameOn={ui.frameOn}
              scanning={ui.canopyScanning || ai.busy === "scanning"}
              zoom={ui.zoom}
              sheetScaleDenom={ui.sheetScaleDenom}
              darkOn={ui.darkOn}
              boundary={studio.boundary}
              building={studio.building}
              siteLabel={displayAddress}
              address={displayAddress}
              parchmentPeel={ui.parchmentPeel}
              onUri={(uri) => studio.setUi({ aerialUri: uri })}
              onScanning={(canopyScanning) => studio.setUi({ canopyScanning })}
              onCanopyImage={ai.ingestCanopyImage}
            />
            <CadPlanBoard
              aerialUri={liveAerial}
              externalAerial
              frameOn={ui.frameOn}
              darkOn={ui.darkOn}
              boundary={studio.boundary}
              building={studio.building}
              items={studio.items}
              tool={ui.tool}
              locked={ui.locked}
              layerOpacity={ui.layerOpacity}
              setbackOn={ui.setbackOn}
              growth={ui.growth}
              selectedId={ui.selectedId}
              groupIds={ui.groupIds}
              hoverId={ui.hoverId}
              curGhostId={ai.current?.id ?? null}
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
                    coachOpen: true,
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
                    coachOpen: true,
                  });
                }}
              />
            ) : null}
            {ui.mode === "sketch" ? (
              <SketchBoard
                strokes={studio.strokes}
                darkOn={ui.darkOn}
                onChange={studio.setStrokes}
              />
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
            showElevations={ui.sheetElevOn}
            scaleDenom={ui.sheetScaleDenom}
            onScaleDenom={(sheetScaleDenom) => studio.setUi({ sheetScaleDenom })}
            titleBlock={titleBlock}
          />
        ) : null}

        {chrome.ambientRibbon ? (
          <AmbientRibbon
            tool={ui.tool}
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
            onZoom={(delta) =>
              studio.setUi({
                zoom: Math.max(
                  0.6,
                  Math.min(2.2, Number((ui.zoom + delta).toFixed(2))),
                ),
              })
            }
            onFit={() => studio.setUi({ zoom: 1 })}
            onOpacity={studio.setLayerOpacity}
            onParchmentPeel={(parchmentPeel) => studio.setUi({ parchmentPeel })}
          />
        ) : null}


        {ui.addOpen && planOn && !ui.focusOn ? (
          <div className={css.addStrip} data-testid="add-symbol-strip">
            {(Object.keys(BY_TYPE) as StudioItemType[])
              .filter((t) => !BY_TYPE[t].existing)
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
              settling={ui.saveStatus === "saving"}
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

        {chromeLive && ui.councilTip ? (
          <div className={css.councilTip} data-testid="council-setback-tip">
            {ui.councilTip}
          </div>
        ) : null}

        {chrome.aiCoach ? (
          <AiCoachDock
            open={ui.coachOpen && !chrome.collapseUtility}
            status={ai.status}
            coaching={ai.coaching}
            pendingCount={ai.pendingCount}
            busy={ai.busy}
            assistReply={ui.assistReply}
            onClose={() => studio.setUi({ coachOpen: false })}
            onScan={() => void ai.scan()}
            onAsk={() =>
              studio.setUi({ cmdOpen: true, cmdQuery: "", coachOpen: true })
            }
            onReview={() => ai.openReview()}
            onAcceptAll={() => ai.acceptAll()}
            onTipAction={onCoachTip}
          />
        ) : null}

        {chromeLive &&
        !ui.coachOpen &&
        !ui.ghostReviewOpen &&
        ai.pendingCount > 0 ? (
          <button
            type="button"
            className={css.ghostToast}
            onClick={() =>
              studio.setUi({ coachOpen: true, ghostReviewOpen: true })
            }
          >
            <span className={css.ghostDot} />
            {ai.pendingCount} AI proposals pending{" "}
            <span className={css.ghostReview}>Review</span>
          </button>
        ) : null}

        {chromeLive && ui.ghostReviewOpen ? (
          <div className={css.ghostPanel}>
            <AiGhostReview
              ghosts={ai.pending}
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

        {chromeLive ? (
          <div className={css.aiStatusBar} data-testid="ai-draft-status-bar">
            <span
              className={`${css.aiStatusChip}${ai.status === "verified" ? ` ${css.aiStatusOk}` : ""}`}
            >
              {draftLabel}
            </span>
            <span className={css.aiStatusMeta}>
              {ai.pendingCount
                ? `${ai.pendingCount} proposal${ai.pendingCount === 1 ? "" : "s"} · A accept · R reject`
                : "Scan or Ask AI to propose layout moves"}
            </span>
            {!ui.coachOpen ? (
              <button
                type="button"
                className={css.aiStatusOpen}
                onClick={() => studio.setUi({ coachOpen: true })}
              >
                Coach
              </button>
            ) : null}
            {ai.pendingCount > 0 ? (
              <button
                type="button"
                className={css.aiStatusOpen}
                data-testid="ai-status-review"
                onClick={() =>
                  studio.setUi({ ghostReviewOpen: !ui.ghostReviewOpen })
                }
              >
                {ui.ghostReviewOpen ? "Hide" : "Review"}
              </button>
            ) : null}
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
          onToggleFitSheet={() => studio.setUi({ frameOn: !ui.frameOn })}
          onGoQuote={() => studio.setMode("quote")}
          onToggleFocus={() => studio.setUi({ focusOn: !ui.focusOn })}
          onUndo={studio.undo}
          onRedo={studio.redo}
        />

        {!ui.clientView ? <StudioCoachMarks /> : null}
      </div>
    </div>
  );
}
