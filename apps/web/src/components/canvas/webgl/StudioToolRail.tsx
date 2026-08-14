"use client";

/**
 * Gold Standard 2026 — Studio Tool Rail (left vertical slim toolbar).
 *
 * The Stitch reference chrome: a slim vertical glass rail pinned to the
 * left border carries every tool toggle — the top-left card no longer
 * accumulates chip rows (the clutter the collision issues came from).
 * Icon + 7.5px label per tool; active tools go gold.
 *
 * Accessible names keep the "▸/▾ Label" contract the e2e suite clicks by
 * (aria-label), so the rail is a pure layout move, not a behaviour change.
 * Pointer capture tools keep their store-enforced mutual exclusion.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §2 (zero-chrome; tools live on the
 * border, the drawing owns the middle)
 */

import { useStudioStore } from "./studioStore";

interface RailTool {
  id: string;
  glyph: string;
  label: string;
  active: boolean;
  onToggle: () => void;
  accent: string;
  title: string;
}

export function StudioToolRail({
  showTerrainTools,
  showDims,
  showEarth,
  showQuote,
  onPresentToggle,
  presentActive,
}: {
  showTerrainTools: boolean;
  showDims: boolean;
  showEarth: boolean;
  showQuote: boolean;
  onPresentToggle: () => void;
  presentActive: boolean;
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
  const fitSheetOpen = useStudioStore((s) => s.fitSheetOpen);
  const setFitSheetOpen = useStudioStore((s) => s.setFitSheetOpen);

  const tools: RailTool[] = [
    {
      id: "present",
      glyph: " ◉ ",
      label: "Present",
      active: presentActive,
      onToggle: onPresentToggle,
      accent: "var(--gs-primary)",
      title: "Presentation lens",
    },
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
      accent: "var(--gs-primary)",
      title: "Freehand ink",
    },
    {
      id: "measure",
      glyph: "⟋",
      label: "Measure",
      active: measureActive,
      onToggle: () => setMeasureActive(!measureActive),
      accent: "var(--gs-truth)",
      title: "Two-point tape",
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
      accent: "var(--gs-primary)",
      title: "Discovery fan-out",
    },
    {
      id: "underground",
      glyph: "▽",
      label: "Underground",
      active: subsurfaceView,
      onToggle: () => setSubsurfaceView(!subsurfaceView),
      accent: "var(--gs-truth)",
      title: "Subsurface blueprint",
    },
    ...(showDims
      ? [
          {
            id: "dims",
            glyph: "↔",
            label: "Dims",
            active: dimsView,
            onToggle: () => setDimsView(!dimsView),
            accent: "var(--gs-truth)",
            title: "Working-drawing dimensions",
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
            accent: "var(--gs-truth)",
            title: "Elevation slice",
          },
          {
            id: "flow",
            glyph: "≈",
            label: "Flow",
            active: drainageView,
            onToggle: () => setDrainageView(!drainageView),
            accent: "var(--gs-truth)",
            title: "Drainage overland flow",
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
            accent: "var(--gs-primary)",
            title: "Cut / fill earthworks",
          },
        ]
      : []),
    ...(showQuote
      ? [
          {
            id: "quote",
            glyph: "$",
            label: "Quote",
            active: fitSheetOpen,
            onToggle: () => setFitSheetOpen(!fitSheetOpen),
            accent: "var(--gs-primary)",
            title: "Itemized fit-sheet",
          },
        ]
      : []),
  ];

  return (
    <nav
      data-testid="studio-tool-rail"
      aria-label="Studio tools"
      style={{
        position: "absolute",
        left: 8,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        pointerEvents: "auto",
        zIndex: 5,
      }}
    >
      {tools.map((t) => {
        const active = t.active;
        const name = `${active ? "▾" : "▸"} ${t.label}`;
        return (
          <button
            key={t.id}
            data-testid={`rail-${t.id}`}
            aria-label={name}
            title={t.title}
            onClick={t.onToggle}
            style={{
              width: 42,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              padding: "5px 0 4px",
              borderRadius: 8,
              border: "1px solid transparent",
              background: active
                ? `color-mix(in srgb, ${t.accent} 12%, transparent)`
                : "transparent",
              color: active ? t.accent : "var(--gs-ink-secondary)",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = "var(--gs-ink)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = "var(--gs-ink-secondary)";
            }}
          >
            <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>
              {t.glyph.trim()}
            </span>
            <span
              aria-hidden
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 7.5,
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
