"use client";

/**
 * Gold Standard 2026 — Studio Command Palette (Cmd/Ctrl+K).
 *
 * The power-operator surface for the WebGL mount: every mode, tool, and
 * camera action reachable by keyboard. Glass chrome per the zero-chrome law
 * — summoned, never parked. Listbox semantics for the a11y gate.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useStudioStore } from "./studioStore";
import { DEFAULT_CAMERA_RIG } from "./cameraRig";
import type { CanvasMode } from "../../../lib/canvas-mode";

type PaletteAction = {
  id: string;
  label: string;
  group: "Mode" | "Tool" | "View" | "Edit";
  hint?: string;
  run: () => void;
};

const chip: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 10,
  letterSpacing: "0.06em",
  padding: "1px 7px",
  borderRadius: "var(--gs-radius-pill)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
  color: "var(--gs-ink-secondary)",
  whiteSpace: "nowrap",
};

export function StudioCommandPalette({
  open,
  onClose,
  onMode,
  onZoom,
  onOpenSitePhotos,
  projectId,
  unlocked,
}: {
  open: boolean;
  onClose: () => void;
  onMode: (mode: CanvasMode) => void;
  onZoom: (direction: 1 | -1) => void;
  /** Open the site-photo gallery meta tab (photo-trace elevation source). */
  onOpenSitePhotos: () => void;
  projectId: string;
  unlocked: ReadonlySet<CanvasMode>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  useFocusTrap(open, panelRef, onClose);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Focus after mount so the input is typeable immediately.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const actions = useMemo<PaletteAction[]>(() => {
    const modes: Array<[CanvasMode, string]> = [
      ["survey", "Survey — site truth checklist"],
      ["sketch", "Sketch — freehand ink (2D + 3D)"],
      ["cad", "CAD — technical plan + AI drafter"],
      ["elevation", "Elevation — N/E/S/W sheet"],
      ["garden", "Garden — eye-level 3D viewpoints"],
      ["quote", "Quote — itemized fit-sheet"],
      ["present", "Present — presentation lens"],
      ["share", "Share — client portal"],
    ];
    const tool = (
      id: string,
      label: string,
      toggle: () => void,
    ): PaletteAction => ({
      id: `tool-${id}`,
      label,
      group: "Tool",
      hint: "toggle",
      run: toggle,
    });
    const store = useStudioStore.getState();
    return [
      ...modes.filter(([mode]) => unlocked.has(mode)).map<PaletteAction>(([mode, label]) => ({
        id: `mode-${mode}`,
        label,
        group: "Mode",
        run: () => onMode(mode),
      })),
      tool("sketch", "Sketch ink", () => {
        store.setArmedSymbolId(null);
        store.setMeasureActive(false);
        store.setSketchMode(!useStudioStore.getState().sketchMode);
      }),
      tool("tidy", "Tidy strokes to CAD proposals", () => {
        useStudioStore.getState().tidySketchToCad();
      }),
      tool("convert-cad", "Convert strokes to CAD features", () => {
        useStudioStore.getState().convertStrokesToCadFeatures();
      }),
      tool("measure", "Measure tape", () =>
        store.setMeasureActive(!useStudioStore.getState().measureActive),
      ),
      tool("assets", "Asset library", () =>
        store.setAssetsOpen(!useStudioStore.getState().assetsOpen),
      ),
      tool("underground", "Subsurface view", () =>
        store.setSubsurfaceView(!useStudioStore.getState().subsurfaceView),
      ),
      tool("split", "Split plan | 3D", () =>
        store.setSplitView(!useStudioStore.getState().splitView),
      ),
      tool("dims", "Working-drawing dims", () =>
        store.setDimsView(!useStudioStore.getState().dimsView),
      ),
      tool("quote", "Fit-sheet", () =>
        store.setFitSheetOpen(!useStudioStore.getState().fitSheetOpen),
      ),
      {
        id: "tool-site-photos",
        label: "Site photos — trace an elevation from a photo",
        group: "Tool",
        hint: "opens",
        run: onOpenSitePhotos,
      },
      {
        id: "trench-drainage",
        label: "Trace trench — drainage",
        group: "Tool",
        run: () => store.setTrenchTool("drainage"),
      },
      {
        id: "trench-irrig-main",
        label: "Trace trench — irrigation main",
        group: "Tool",
        run: () => store.setTrenchTool("irrig_main"),
      },
      {
        id: "trench-irrig-lateral",
        label: "Trace trench — irrigation lateral",
        group: "Tool",
        run: () => store.setTrenchTool("irrig_lateral"),
      },
      {
        id: "trench-lighting",
        label: "Trace trench — lighting conduit",
        group: "Tool",
        run: () => store.setTrenchTool("lighting_conduit"),
      },
      {
        id: "zone-drip",
        label: "Trace zone — drip",
        group: "Tool",
        run: () => store.setZoneTool("drip"),
      },
      {
        id: "zone-spray",
        label: "Trace zone — spray",
        group: "Tool",
        run: () => store.setZoneTool("spray"),
      },
      {
        id: "zone-lighting",
        label: "Trace lighting run",
        group: "Tool",
        run: () => store.setZoneTool("lighting"),
      },
      {
        id: "view-plan",
        label: "Plan view (orthographic)",
        group: "View",
        run: () => store.setPitchDeg(0),
      },
      {
        id: "view-3d",
        label: "3D view (perspective)",
        group: "View",
        run: () => store.setPitchDeg(DEFAULT_CAMERA_RIG.tiltDeg),
      },
      {
        id: "view-zoom-in",
        label: "Zoom in",
        group: "View",
        run: () => onZoom(1),
      },
      {
        id: "view-zoom-out",
        label: "Zoom out",
        group: "View",
        run: () => onZoom(-1),
      },
      {
        id: "edit-undo",
        label: "Undo",
        group: "Edit",
        hint: "Ctrl+Z",
        run: () => useStudioStore.getState().undo(),
      },
      {
        id: "edit-redo",
        label: "Redo",
        group: "Edit",
        hint: "Ctrl+Shift+Z",
        run: () => useStudioStore.getState().redo(),
      },
      {
        id: "view-subsurface-studio",
        label: "Subsurface studio — full-screen 3D underground",
        group: "View",
        hint: "opens",
        run: () => window.location.assign(`/subsurface-studio/${projectId}`),
      },
    ];
  }, [onMode, onOpenSitePhotos, onZoom, projectId, unlocked]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.group.toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => setActiveIdx(0), [query]);

  if (!open) return null;

  const runAt = (i: number) => {
    const a = filtered[i];
    if (!a) return;
    a.run();
    onClose();
  };

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        top: 110,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(460px, 92vw)",
        pointerEvents: "auto",
        zIndex: 20,
        borderRadius: "var(--gs-radius-panel)",
        background: "color-mix(in srgb, var(--gs-glass) 55%, transparent)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        border: "1px solid color-mix(in srgb, var(--gs-line) 40%, transparent)",
        boxShadow: "0 12px 40px color-mix(in srgb, var(--gs-frame) 75%, transparent)",
        fontFamily: "var(--font-ui)",
        color: "var(--gs-ink)",
        overflow: "hidden",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      data-testid="studio-command-palette"
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        aria-label="Search commands"
        data-testid="command-palette-input"
        placeholder="Search modes, tools, actions…"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            runAt(activeIdx);
          }
        }}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          fontFamily: "var(--font-ui)",
          fontSize: 13,
          color: "var(--gs-ink)",
          background: "transparent",
          border: "none",
          borderBottom: "1px solid color-mix(in srgb, var(--gs-line) 40%, transparent)",
        }}
      />
      <div role="listbox" aria-label="Commands" style={{ maxHeight: 300, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <p
            style={{ padding: "10px 12px", fontSize: 11.5, color: "var(--gs-ink-secondary)", margin: 0 }}
          >
            No commands match “{query}”.
          </p>
        ) : (
          filtered.map((a, i) => (
            <div
              key={a.id}
              role="option"
              aria-selected={i === activeIdx}
              data-testid={`command-${a.id}`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => runAt(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                fontSize: 11.5,
                cursor: "pointer",
                background:
                  i === activeIdx
                    ? "color-mix(in srgb, var(--gs-primary) 14%, transparent)"
                    : "transparent",
                color: i === activeIdx ? "var(--gs-primary)" : "var(--gs-ink)",
              }}
            >
              <span style={chip}>{a.group}</span>
              <span style={{ flex: 1 }}>{a.label}</span>
              {a.hint ? <span style={chip}>{a.hint}</span> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
