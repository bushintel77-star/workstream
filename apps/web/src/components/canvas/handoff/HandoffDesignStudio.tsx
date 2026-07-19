"use client";

import { useEffect, useRef, useState } from "react";
import {
  BY_TYPE,
  MODE_TABS,
  TOOLS,
  type StudioItemType,
  type StudioMode,
} from "./studioCatalog";
import { useStudioState } from "./state/useStudioState";
import { CadPlanBoard } from "./features/cadPlan/CadPlanBoard";
import { FitSheetOverlay } from "./features/fitSheet/FitSheetOverlay";
import { AiGhostReview } from "./features/aiGhosts/AiGhostReview";
import { LayersPanel } from "./features/layers/LayersPanel";
import { StudioCommandPalette } from "./features/commandPalette/StudioCommandPalette";
import { SunGrowthDock } from "./features/sunGrowth/SunGrowthDock";
import { ComplianceDock } from "./features/compliance/ComplianceDock";
import { LiveBomDock } from "./features/bom/LiveBomDock";
import { QuoteSurface } from "./features/tier1/QuoteSurface";
import { ElevationBoard } from "./features/elevation/ElevationBoard";
import css from "./handoffStudio.module.css";

type Props = {
  projectId: string;
  projectAddress: string;
  aerialUri?: string | null;
  areaM2?: number | null;
  initialMode?: StudioMode;
};

/**
 * Design Studio v4/v5 shell — composes feature modules on `useStudioState`.
 * %‑coord aerial drafting board (not MapLibre / Vicmap title chrome).
 */
export function HandoffDesignStudio({
  projectAddress,
  aerialUri = null,
  areaM2 = 230.82,
  initialMode = "cad",
}: Props) {
  const studio = useStudioState(
    MODE_TABS.includes(initialMode as StudioMode) ? initialMode : "cad",
  );
  const { ui } = studio;
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ w: 960, h: 640 });

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
      if (e.key === "Escape") {
        studio.setUi({
          factorsOpen: false,
          layersOpen: false,
          cmdOpen: false,
          addOpen: false,
          sitesOpen: false,
        });
        return;
      }
      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        studio.setUi({ frameOn: !ui.frameOn });
        return;
      }
      if (e.key.toLowerCase() === "a" && studio.curGhost) {
        e.preventDefault();
        studio.acceptGhost(studio.curGhost.id);
        return;
      }
      if (e.key.toLowerCase() === "r" && studio.curGhost) {
        e.preventDefault();
        studio.rejectGhost(studio.curGhost.id);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio, ui.cmdOpen, ui.frameOn]);

  const planOn = ui.mode !== "elevation" && ui.mode !== "quote";
  const showDocks =
    !ui.focusOn && planOn && !ui.frameOn && ui.mode !== "survey" && !ui.clientView;
  const outdoor = areaM2 ?? 230.82;

  const armType = (t: StudioItemType) => {
    studio.setUi({ armed: t, tool: "add", addOpen: true, cmdOpen: false });
  };

  return (
    <div
      className={`${css.root}${ui.darkOn ? ` ${css.rootDark}` : ""}${ui.focusOn ? ` ${css.rootFocus}` : ""}`}
      data-testid="handoff-design-studio"
      data-studio-surface="handoff-v4"
    >
      <header className={css.header} data-testid="canvas-studio-header">
        <div>
          <p className={css.brandName}>Curtis &amp; Co</p>
          <p className={css.address}>{projectAddress}</p>
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
          <div className={css.metaDetail}>
            Vicmap · Land Vic · {Number(outdoor).toFixed(2)} m²
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
              onClick={() => studio.setUi({ sheetElevOn: !ui.sheetElevOn })}
              title="Stacked elevations on Fit sheet"
            >
              Elev
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
          onClick={() => studio.setUi({ clientView: !ui.clientView, focusOn: true })}
        >
          Client view
        </button>
        <button
          type="button"
          className={css.cmdBtn}
          data-testid="canvas-command-top"
          onClick={() => studio.setUi({ cmdOpen: true })}
        >
          ⌘K
        </button>
        <button
          type="button"
          className={`${css.aiPill}${studio.ghostCount === 0 ? ` ${css.aiPillOk}` : ""}`}
          data-testid="header-accept-ghosts"
          onClick={() => {
            if (studio.ghostCount === 0) {
              studio.scanGhosts();
              return;
            }
            studio.acceptAllGhosts();
          }}
        >
          {studio.ghostCount
            ? `AI draft · ${studio.ghostCount} pending`
            : "AI draft · verified"}
        </button>
      </header>

      <div className={css.board} data-testid="studio-board" ref={boardRef}>
        {ui.mode === "elevation" ? (
          <ElevationBoard
            axis={ui.elevAxis}
            boundary={studio.boundary}
            building={studio.building}
            items={studio.items}
            onToggleAxis={() =>
              studio.setUi({ elevAxis: ui.elevAxis === "x" ? "y" : "x" })
            }
          />
        ) : null}

        {ui.mode === "quote" ? (
          <QuoteSurface
            address={projectAddress}
            items={studio.items}
            onBack={() => studio.setMode("cad")}
          />
        ) : null}

        {planOn ? (
          <CadPlanBoard
            aerialUri={aerialUri}
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
            hoverId={ui.hoverId}
            curGhostId={studio.curGhost?.id ?? null}
            onSelect={(id) => {
              studio.setUi({ selectedId: id });
              if (id && studio.ghosts.some((g) => g.id === id)) {
                const idx = studio.ghosts.findIndex((g) => g.id === id);
                studio.setUi({
                  selectedId: id,
                  ghostIdx: idx >= 0 ? idx : ui.ghostIdx,
                  factorsOpen: true,
                });
              }
            }}
            onHover={(id) => studio.setUi({ hoverId: id })}
            onAcceptGhost={studio.acceptGhost}
            onRejectGhost={studio.rejectGhost}
            onTraceInElevation={(id) => {
              studio.setUi({ selectedId: id });
              studio.setMode("elevation");
            }}
            onBoundaryChange={studio.updateBoundary}
            onBuildingChange={studio.updateBuilding}
            onPlace={studio.placeArmed}
            onMoveItem={studio.moveItem}
          />
        ) : null}

        {ui.frameOn && planOn ? (
          <FitSheetOverlay
            boardW={boardSize.w}
            boardH={boardSize.h}
            paper={ui.paper}
            address={projectAddress}
            boundary={studio.boundary}
            building={studio.building}
            items={studio.items}
            showElevations={ui.sheetElevOn}
          />
        ) : null}

        {!ui.focusOn && planOn && ui.mode !== "survey" ? (
          <nav className={css.rail} data-testid="canvas-tool-rail" aria-label="Drawing tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${css.railBtn}${ui.tool === t.id || (t.id === "lock" && ui.locked) ? ` ${css.railBtnActive}` : ""}`}
                data-testid={`canvas-tool-${t.id}`}
                title={t.label}
                onClick={() => studio.setTool(t.id)}
              >
                <span className={css.railIcon}>{t.icon}</span>
                <span className={css.railLabel}>{t.label}</span>
              </button>
            ))}
            <div className={css.railDiv} />
            <button
              type="button"
              className={css.railBtn}
              title="Undo"
              disabled={!studio.canUndo}
              onClick={studio.undo}
            >
              <span className={css.railIcon}>↩</span>
            </button>
            <button
              type="button"
              className={css.railBtn}
              title="Redo"
              disabled={!studio.canRedo}
              onClick={studio.redo}
            >
              <span className={css.railIcon}>↪</span>
            </button>
          </nav>
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
            <ComplianceDock
              outdoorM2={outdoor}
              boundary={studio.boundary}
              items={studio.items}
            />
            <SunGrowthDock
              sunMin={ui.sunMin}
              growth={ui.growth}
              onSunMin={(sunMin) => studio.setUi({ sunMin })}
              onGrowth={(growth) => studio.setUi({ growth })}
            />
            <LiveBomDock
              items={studio.items}
              mitigated={ui.mitigated}
              onMitigate={(id) =>
                studio.setUi({
                  mitigated: { ...ui.mitigated, [id]: !ui.mitigated[id] },
                })
              }
              onOpenQuote={() => studio.setMode("quote")}
            />
          </>
        ) : null}

        {studio.ghostCount > 0 && planOn && !ui.focusOn ? (
          <button
            type="button"
            className={css.ghostToast}
            onClick={() => studio.setUi({ factorsOpen: !ui.factorsOpen })}
          >
            <span className={css.ghostDot} />
            {studio.ghostCount} AI suggestions ready{" "}
            <span className={css.ghostReview}>Review</span>
          </button>
        ) : null}

        {ui.factorsOpen && planOn && !ui.focusOn ? (
          <div className={css.ghostPanel}>
            <AiGhostReview
              ghosts={studio.ghosts}
              selectedId={studio.curGhost?.id ?? null}
              onSelect={(id) => {
                const idx = studio.ghosts.findIndex((g) => g.id === id);
                studio.setUi({ ghostIdx: idx >= 0 ? idx : ui.ghostIdx });
              }}
              onAccept={studio.acceptGhost}
              onReject={studio.rejectGhost}
              onCycle={studio.cycleGhost}
              onAskAi={(id) => {
                const g = studio.ghosts.find((x) => x.id === id);
                studio.askAi(g?.why ?? "refine this suggestion");
              }}
            />
          </div>
        ) : null}

        <LayersPanel
          open={ui.layersOpen}
          opacity={ui.layerOpacity}
          setbackOn={ui.setbackOn}
          onClose={() => studio.setUi({ layersOpen: false })}
          onOpacity={studio.setLayerOpacity}
          onSetback={(setbackOn) => studio.setUi({ setbackOn })}
        />

        <StudioCommandPalette
          open={ui.cmdOpen}
          query={ui.cmdQuery}
          onQuery={(cmdQuery) => studio.setUi({ cmdQuery })}
          onClose={() => studio.setUi({ cmdOpen: false, cmdQuery: "" })}
          onAskAi={studio.askAi}
          onArm={armType}
          onScanGhosts={studio.scanGhosts}
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
