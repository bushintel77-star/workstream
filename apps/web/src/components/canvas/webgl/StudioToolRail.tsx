"use client";

/**
 * Gold Standard 2026 — Studio Tool Rail (left vertical slim toolbar).
 *
 * The Stitch reference chrome: a slim vertical glass rail pinned to the
 * left border carries every tool toggle — the top-left card no longer
 * accumulates chip rows (the clutter the collision issues came from).
 * Icon + 7.5px label per tool; active tools go charcoal (the selection
 * vocabulary — crimson stays reserved for CTA/critical per TOKENS.md §1).
 *
 * Accessible names keep the "▸/▾ Label" contract the e2e suite clicks by
 * (aria-label), so the rail is a pure layout move, not a behaviour change.
 * Pointer capture tools keep their store-enforced mutual exclusion.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §2 (zero-chrome; tools live on the
 * border, the drawing owns the middle)
 */

import { useState } from "react";
import { useStudioStore } from "./studioStore";
import { Button } from "./Button";

type RailGroup = "core" | "site" | "view";

interface RailTool {
  id: string;
  glyph: string;
  label: string;
  active: boolean;
  onToggle: () => void;
  accent: string;
  title: string;
  disabled?: boolean;
  group: RailGroup;
  advanced?: boolean;
}

export function StudioToolRail({
  showTerrainTools,
  showDims,
  showEarth,
  onPresentToggle,
  presentActive,
  showTidy,
  tidyDisabled,
  onTidy,
}: {
  showTerrainTools: boolean;
  showDims: boolean;
  showEarth: boolean;
  onPresentToggle: () => void;
  presentActive: boolean;
  /** Show the sketch→CAD tidy action (sketch mode or ink on the board). */
  showTidy: boolean;
  /** Tidy needs at least one stroke. */
  tidyDisabled: boolean;
  onTidy: () => void;
}) {
  const subsurfaceView = useStudioStore((s) => s.subsurfaceView);
  const setSubsurfaceView = useStudioStore((s) => s.setSubsurfaceView);
  const sketchMode = useStudioStore((s) => s.sketchMode);
  const setSketchMode = useStudioStore((s) => s.setSketchMode);
  const setMeasureActive = useStudioStore((s) => s.setMeasureActive);
  const measureActive = useStudioStore((s) => s.measureActive);
  const assetsOpen = useStudioStore((s) => s.assetsOpen);
  const setAssetsOpen = useStudioStore((s) => s.setAssetsOpen);
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const setArmedSymbolId = useStudioStore((s) => s.setArmedSymbolId);
  const sliceActive = useStudioStore((s) => s.sliceActive);
  const setSliceActive = useStudioStore((s) => s.setSliceActive);
  const drainageView = useStudioStore((s) => s.drainageView);
  const setDrainageView = useStudioStore((s) => s.setDrainageView);
  const earthworksView = useStudioStore((s) => s.earthworksView);
  const setEarthworksView = useStudioStore((s) => s.setEarthworksView);
  const dimsView = useStudioStore((s) => s.dimsView);
  const setDimsView = useStudioStore((s) => s.setDimsView);
  const splitView = useStudioStore((s) => s.splitView);
  const setSplitView = useStudioStore((s) => s.setSplitView);
  const trenchTool = useStudioStore((s) => s.trenchTool);
  const setTrenchTool = useStudioStore((s) => s.setTrenchTool);
  const zoneTool = useStudioStore((s) => s.zoneTool);
  const setZoneTool = useStudioStore((s) => s.setZoneTool);
  const marqueeActive = useStudioStore((s) => s.marqueeActive);
  const setMarqueeActive = useStudioStore((s) => s.setMarqueeActive);
  const draftSession = useStudioStore((s) => s.draftSession);
  const beginDraft = useStudioStore((s) => s.beginDraft);
  const cancelDraft = useStudioStore((s) => s.cancelDraft);

  const [moreOpen, setMoreOpen] = useState(false);

  /** Toggle a precision drafting tool — re-clicking the armed one disarms. */
  const toggleDraft = (tool: "polyline" | "area") => {
    if (draftSession?.tool === tool) cancelDraft();
    else beginDraft(tool);
  };

  const tools: RailTool[] = [
    {
      id: "sketch",
      glyph: "✎",
      label: "Sketch",
      active: sketchMode,
      onToggle: () => {
        const next = !sketchMode;
        if (next) {
          setArmedSymbolId(null);
          setMeasureActive(false);
        }
        setSketchMode(next);
      },
      accent: "var(--la-accent)",
      title: "Freehand ink (S)",
      group: "core",
    },
    {
      id: "measure",
      glyph: "⟋",
      label: "Measure",
      active: measureActive,
      onToggle: () => setMeasureActive(!measureActive),
      accent: "var(--gs-ink-truth)",
      title: "Two-point tape (M)",
      group: "core",
    },
    {
      id: "assets",
      glyph: "❖",
      label: "Assets",
      active: assetsOpen || armedSymbolId != null,
      onToggle: () => {
        const next = !assetsOpen;
        if (!next) setArmedSymbolId(null);
        setAssetsOpen(next);
      },
      accent: "var(--la-accent)",
      title: "Discovery fan-out (A)",
      group: "core",
    },
    {
      id: "polyline",
      glyph: "⌒",
      label: "Polyline",
      active: draftSession?.tool === "polyline",
      onToggle: () => toggleDraft("polyline"),
      accent: "var(--la-accent)",
      title:
        "Click exact vertices for a setout line — snaps to vertices, the title boundary and 45°. Enter finishes, Backspace steps back, Esc cancels",
      group: "core",
    },
    {
      id: "area",
      glyph: "▱",
      label: "Area",
      active: draftSession?.tool === "area",
      onToggle: () => toggleDraft("area"),
      accent: "var(--la-accent)",
      title:
        "Click exact vertices for a closed region — finishes on the origin snap and persists as a costable area",
      group: "core",
    },
    {
      id: "marquee",
      glyph: "▭",
      label: "Marquee",
      active: marqueeActive,
      onToggle: () => setMarqueeActive(!marqueeActive),
      accent: "var(--la-accent)",
      title: "Drag a box to select placements and features (shift adds)",
      group: "core",
    },
    ...(showTidy
      ? [
          {
            id: "tidy",
            glyph: "◇",
            label: "Tidy",
            active: false,
            onToggle: onTidy,
            accent: "var(--la-accent)",
            title: tidyDisabled
              ? "Draw ink first — strokes become CAD proposals"
              : "Tidy strokes → confidence-scored CAD proposals (accept/reject review)",
            disabled: tidyDisabled,
            group: "core" as const,
          },
        ]
      : []),
    {
      id: "trench",
      glyph: "≋",
      label: "Trench",
      active: trenchTool != null,
      onToggle: () => setTrenchTool(trenchTool ? null : "drainage"),
      accent: "var(--gs-ink-truth)",
      title: "Trace drainage trench (advanced)",
      group: "site",
      advanced: true,
    },
    {
      id: "zones",
      glyph: "◎",
      label: "Zones",
      active: zoneTool != null && zoneTool !== "lighting",
      onToggle: () => setZoneTool(zoneTool && zoneTool !== "lighting" ? null : "drip"),
      accent: "var(--gs-ink-truth)",
      title: "Trace irrigation zone (advanced)",
      group: "site",
      advanced: true,
    },
    {
      id: "lighting",
      glyph: "ϟ",
      label: "Lighting",
      active: zoneTool === "lighting",
      onToggle: () => setZoneTool(zoneTool === "lighting" ? null : "lighting"),
      accent: "var(--gs-ink-truth)",
      title: "Trace lighting run (advanced)",
      group: "site",
      advanced: true,
    },
    {
      id: "underground",
      glyph: "▽",
      label: "Underground",
      active: subsurfaceView,
      onToggle: () => setSubsurfaceView(!subsurfaceView),
      accent: "var(--gs-ink-truth)",
      title: "Subsurface blueprint (U)",
      group: "site",
    },
    {
      id: "present",
      glyph: " ◉ ",
      label: "Present",
      active: presentActive,
      onToggle: onPresentToggle,
      accent: "var(--la-accent)",
      title: "Presentation lens (Shift+7)",
      group: "view",
    },
    {
      id: "split",
      glyph: "⋈",
      label: "Split",
      active: splitView,
      onToggle: () => setSplitView(!splitView),
      accent: "var(--la-accent)",
      title: "Plan | 3D split view (linked cameras)",
      group: "view",
    },
    ...(showDims
      ? [
          {
            id: "dims",
            glyph: "↔",
            label: "Dims",
            active: dimsView,
            onToggle: () => setDimsView(!dimsView),
            accent: "var(--gs-ink-truth)",
            title: "Working-drawing dimensions (D)",
            group: "view" as const,
          },
        ]
      : []),
    ...(showTerrainTools
      ? [
          {
            id: "section",
            glyph: "⌐",
            label: "Section",
            active: sliceActive,
            onToggle: () => setSliceActive(!sliceActive),
            accent: "var(--gs-ink-truth)",
            title: "Elevation slice (advanced)",
            group: "view" as const,
            advanced: true,
          },
          {
            id: "flow",
            glyph: "≈",
            label: "Flow",
            active: drainageView,
            onToggle: () => setDrainageView(!drainageView),
            accent: "var(--gs-ink-truth)",
            title: "Drainage overland flow (advanced)",
            group: "view" as const,
            advanced: true,
          },
        ]
      : []),
    ...(showEarth
      ? [
          {
            id: "earth",
            glyph: "◭",
            label: "Earth",
            active: earthworksView,
            onToggle: () => setEarthworksView(!earthworksView),
            accent: "var(--la-accent)",
            title: "Cut / fill earthworks (advanced)",
            group: "view" as const,
            advanced: true,
          },
        ]
      : []),
  ];

  const visible = tools.filter((t) => moreOpen || !t.advanced || t.active);

  return (
    <nav
      data-testid="studio-tool-rail"
      aria-label="Studio tools"
      style={{
        position: "absolute",
        left: 8,
        top: 152,
        display: "flex",
        flexDirection: "column",
        gap: "var(--gs-space-1)",
        pointerEvents: "auto",
        zIndex: "var(--cf-z-chrome)",
        // Floating element: the rail is a glass panel, not a naked column
        // of buttons hovering over the drawing (GlassCard recipe — veil +
        // blur + hairline + neutral shadow tier).
        background: "var(--la-surface)",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        borderRadius: "var(--gs-radius-panel)",
        border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
        boxShadow: "var(--gs-shadow-2)",
        padding: "6px",
        // Short viewports: the rail scrolls internally instead of escaping
        // the canvas edge (webgl-chrome-collision gate).
        maxHeight: "calc(100dvh - 170px)",
        overflowY: "auto",
        scrollbarWidth: "none",
      }}
    >
      {visible.map((t, i) => {
        const active = t.active;
        const name = `${active ? "▾" : "▸"} ${t.label}`;
        const prev = visible[i - 1];
        const showRule = Boolean(prev && prev.group !== t.group);
        return (
          <span key={t.id} style={{ display: "contents" }}>
            {showRule ? (
              <span
                aria-hidden
                style={{
                  height: 1,
                  margin: "3px 4px",
                  background: "color-mix(in srgb, var(--gs-line) 55%, transparent)",
                }}
              />
            ) : null}
          <Button
            variant="swatch"
            data-testid={`rail-${t.id}`}
            aria-label={name}
            title={t.title}
            active={active}
            disabled={t.disabled === true}
            onClick={t.onToggle}
          >
            <span
              aria-hidden
              style={{ fontSize: "var(--gs-font-sub)", lineHeight: 1 }}
            >
              {t.glyph.trim()}
            </span>
            {active ? (
              <span
                aria-hidden
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "var(--gs-font-xs)",
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
              >
                {t.label}
              </span>
            ) : null}
          </Button>
          </span>
        );
      })}
      {tools.some((t) => t.advanced) ? (
        <Button
          variant="swatch"
          data-testid="rail-more"
          aria-label={moreOpen ? "▾ Less" : "▸ More"}
          aria-expanded={moreOpen}
          title={moreOpen ? "Hide advanced site tools" : "Show trench, zones, lighting, terrain"}
          active={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span aria-hidden style={{ fontSize: "var(--gs-font-sub)", lineHeight: 1 }}>
            …
          </span>
          <span
            aria-hidden
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "var(--gs-font-xs)",
              letterSpacing: "0.04em",
              lineHeight: 1,
            }}
          >
            {moreOpen ? "Less" : "More"}
          </span>
        </Button>
      ) : null}
    </nav>
  );
}
