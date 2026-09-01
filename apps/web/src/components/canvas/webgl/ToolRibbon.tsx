"use client";

/**
 * Landscape Canvas v2 — the categorical vertical tool ribbon (handoff §5).
 *
 * Replaces the Stage One horizontal bottom tool dock. Vertical glass panel,
 * hand-opposite edge, top-aligned at inset 30px. Five groups (DRAW, GRADE,
 * PLANT, BUILD, MEASURE) + a utility row (Layers, History).
 *
 * Three widths, chosen for the user (no manual collapse):
 *   RAIL 56px  — while the pen is down (pen-down quiet state, §5.5)
 *   STANDARD 88px — at rest
 *   NAMED 236px — on 400ms pointer dwell or CmdK (adds names + hotkeys)
 *
 * Active tool: accent fill, dark glyph/label, 4px corner triangle when it
 * has a flyout. The active tool's group header turns accent — the only
 * wayfinding in rail width.
 */

import { useCallback, useEffect, useRef } from "react";
import { useStudioStore, type ToolId } from "./studioStore";
import styles from "./ToolRibbon.module.css";

/* ---- tool definitions (handoff §5.1) ---- */

interface ToolDef {
  id: ToolId;
  label: string;
  hotkey: string;
  glyph: string;
  hasFlyout?: boolean;
}

interface ToolGroup {
  name: string;
  tools: ToolDef[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    name: "DRAW",
    tools: [
      { id: "pen", label: "PEN", hotkey: "P", glyph: "pen" },
      { id: "line", label: "LINE", hotkey: "L", glyph: "line" },
      { id: "spline", label: "SPLINE", hotkey: "S", glyph: "spline" },
    ],
  },
  {
    name: "GRADE",
    tools: [
      { id: "contour", label: "CONTOUR", hotkey: "C", glyph: "contour", hasFlyout: true },
      { id: "slope", label: "SLOPE", hotkey: "G", glyph: "slope" },
      { id: "cutfill", label: "CUT/FILL", hotkey: "", glyph: "cutfill" },
    ],
  },
  {
    name: "PLANT",
    tools: [
      { id: "tree", label: "TREE", hotkey: "", glyph: "tree" },
      { id: "bed", label: "BED", hotkey: "", glyph: "bed" },
    ],
  },
  {
    name: "BUILD",
    tools: [
      { id: "mass", label: "MASS", hotkey: "", glyph: "mass" },
      { id: "path", label: "PATH", hotkey: "", glyph: "path" },
    ],
  },
  {
    name: "MEASURE",
    tools: [
      { id: "dim", label: "DIM", hotkey: "", glyph: "dim" },
      { id: "section", label: "SECTION", hotkey: "", glyph: "section" },
    ],
  },
];

const UTILITY_TOOLS: ToolDef[] = [
  // No hotkeys here: L is claimed by LINE below, and H is the global
  // hold-to-peek key (fade chrome) — see WebGLStudioPreview.
  { id: "layers", label: "LAYERS", hotkey: "", glyph: "layers" },
  { id: "history", label: "HISTORY", hotkey: "", glyph: "history" },
];

/* ---- inline SVG glyphs (handoff §10: no icon set, inline line SVGs) ---- */

function ToolGlyph({ name }: { name: string }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "pen":
      return (
        <svg {...common}>
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      );
    case "line":
      return (
        <svg {...common}>
          <line x1="5" y1="19" x2="19" y2="5" />
          <circle cx="5" cy="19" r="1.5" />
          <circle cx="19" cy="5" r="1.5" />
        </svg>
      );
    case "spline":
      return (
        <svg {...common}>
          <path d="M3 17c4-8 8-8 12-4s6 4 6 0" />
          <circle cx="3" cy="17" r="1.5" />
          <circle cx="21" cy="13" r="1.5" />
        </svg>
      );
    case "contour":
      return (
        <svg {...common}>
          <path d="M3 12c3-3 6-3 9 0s6 3 9 0" />
          <path d="M3 17c3-3 6-3 9 0s6 3 9 0" />
          <path d="M3 7c3-3 6-3 9 0s6 3 9 0" />
        </svg>
      );
    case "slope":
      return (
        <svg {...common}>
          <path d="M3 20L21 4" />
          <path d="M3 20h18" />
          <path d="M17 4h4v4" />
        </svg>
      );
    case "cutfill":
      return (
        <svg {...common}>
          <path d="M3 14h18l-3 6H6z" />
          <path d="M3 14l3-6h12l3 6" />
          <line x1="9" y1="8" x2="9" y2="14" strokeDasharray="2 2" />
          <line x1="15" y1="8" x2="15" y2="14" strokeDasharray="2 2" />
        </svg>
      );
    case "tree":
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="6" />
          <line x1="12" y1="15" x2="12" y2="21" />
          <line x1="9" y1="21" x2="15" y2="21" />
        </svg>
      );
    case "bed":
      return (
        <svg {...common}>
          <path d="M3 16c3-2 6-2 9 0s6 2 9 0" />
          <path d="M3 12c3-2 6-2 9 0s6 2 9 0" />
          <line x1="3" y1="20" x2="21" y2="20" />
        </svg>
      );
    case "mass":
      return (
        <svg {...common}>
          <path d="M4 20V8l8-4 8 4v12" />
          <path d="M4 20h16" />
          <line x1="12" y1="4" x2="12" y2="20" strokeDasharray="2 2" />
        </svg>
      );
    case "path":
      return (
        <svg {...common}>
          <path d="M4 18c4-8 12-8 16 0" strokeDasharray="3 2" />
          <circle cx="4" cy="18" r="1.5" />
          <circle cx="20" cy="18" r="1.5" />
        </svg>
      );
    case "dim":
      return (
        <svg {...common}>
          <line x1="4" y1="20" x2="20" y2="20" />
          <line x1="4" y1="16" x2="4" y2="20" />
          <line x1="20" y1="16" x2="20" y2="20" />
          <line x1="4" y1="8" x2="20" y2="8" strokeDasharray="2 2" />
          <text x="12" y="6" fontSize="7" fill="currentColor" stroke="none" textAnchor="middle">
            L
          </text>
        </svg>
      );
    case "section":
      return (
        <svg {...common}>
          <line x1="4" y1="4" x2="4" y2="20" />
          <line x1="20" y1="4" x2="20" y2="20" />
          <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="3 2" />
          <text x="12" y="10" fontSize="6" fill="currentColor" stroke="none" textAnchor="middle">
            A
          </text>
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
          <path d="M3 17l9 5 9-5" opacity="0.5" />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="15" y1="14" x2="12" y2="12" />
        </svg>
      );
    default:
      return null;
  }
}

/* ---- component ---- */

export function ToolRibbon() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const handedness = useStudioStore((s) => s.handedness);
  const penDown = useStudioStore((s) => s.penDown);
  const ribbonDwellOpen = useStudioStore((s) => s.ribbonDwellOpen);
  const setRibbonDwellOpen = useStudioStore((s) => s.setRibbonDwellOpen);

  // 400ms pointer dwell → named width (handoff §5.2)
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPointerEnter = useCallback(() => {
    dwellTimer.current = setTimeout(() => {
      setRibbonDwellOpen(true);
    }, 400);
  }, [setRibbonDwellOpen]);

  const onPointerLeave = useCallback(() => {
    if (dwellTimer.current) {
      clearTimeout(dwellTimer.current);
      dwellTimer.current = null;
    }
    setRibbonDwellOpen(false);
  }, [setRibbonDwellOpen]);

  useEffect(() => {
    return () => {
      if (dwellTimer.current) clearTimeout(dwellTimer.current);
    };
  }, []);

  // Width resolution: rail (pen down) > named (dwell/CmdK) > standard
  const width = penDown
    ? "rail"
    : ribbonDwellOpen
      ? "named"
      : "standard";

  const isLeft = handedness === "LEFT";
  // Hand-opposite edge: for RIGHT-handed users the ribbon goes on the LEFT
  // (opposite the drawing hand), for LEFT-handed users on the RIGHT.
  // The depth rail stays on the hand-side (mirrored).
  const sideClass = isLeft ? styles.ribbonLeft : styles.ribbonRight;
  const widthClass =
    width === "rail"
      ? styles.ribbonRail
      : width === "named"
        ? styles.ribbonNamed
        : styles.ribbonStandard;

  // Find which group contains the active tool (for accent header)
  const activeGroupName = TOOL_GROUPS.find((g) =>
    g.tools.some((t) => t.id === activeTool),
  )?.name;

  return (
    <div
      className={`${styles.ribbon} ${sideClass} ${widthClass}`}
      data-testid="tool-ribbon"
      data-ribbon-width={width}
      data-handedness={handedness.toLowerCase()}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {/* Header — hidden in rail width (§5.1: glyph-only) */}
      {width !== "rail" && (
        <div className={styles.header}>
          <span className={styles.headerLabel}>TOOLS</span>
        </div>
      )}

      {/* Group pips — 3 dots under the header (standard/named only) */}
      {width !== "rail" && (
        <div className={styles.groupPips}>
          {TOOL_GROUPS.slice(0, 3).map((g) => (
            <span
              key={g.name}
              className={`${styles.pip} ${activeGroupName === g.name ? styles.pipActive : ""}`}
            />
          ))}
        </div>
      )}

      {/* Tool groups */}
      {TOOL_GROUPS.map((group, gi) => (
        <div key={group.name} className={styles.group}>
          {/* Group divider (not before the first group) */}
          {gi > 0 && <div className={styles.groupDivider} />}

          {/* Group header — accent when the active tool is in this group */}
          {width !== "rail" && (
            <div
              className={`${styles.groupHeader} ${activeGroupName === group.name ? styles.groupHeaderActive : ""}`}
            >
              {group.name}
            </div>
          )}

          {/* Tool tiles */}
          {group.tools.map((tool) => (
            <ToolTile
              key={tool.id}
              tool={tool}
              active={activeTool === tool.id}
              width={width}
              onClick={() => {
                // Toggle: clicking the active tool deactivates it
                if (activeTool === tool.id) {
                  setActiveTool("none");
                } else {
                  setActiveTool(tool.id);
                }
              }}
            />
          ))}
        </div>
      ))}

      {/* Utility row — Layers + History, two 28px tiles side by side */}
      <div className={styles.groupDivider} />
      <div className={styles.utilityRow}>
        {UTILITY_TOOLS.map((tool) => (
          <ToolTile
            key={tool.id}
            tool={tool}
            active={activeTool === tool.id}
            width={width}
            compact
            onClick={() => {
              if (activeTool === tool.id) {
                setActiveTool("none");
              } else {
                setActiveTool(tool.id);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ---- tool tile ---- */

interface ToolTileProps {
  tool: ToolDef;
  active: boolean;
  width: "rail" | "standard" | "named";
  compact?: boolean;
  onClick: () => void;
}

function ToolTile({ tool, active, width, compact, onClick }: ToolTileProps) {
  const className = [
    styles.tile,
    active ? styles.tileActive : "",
    compact ? styles.tileCompact : "",
    width === "rail" ? styles.tileRail : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={className}
      data-tool-id={tool.id}
      data-active={active}
      onClick={onClick}
      title={`${tool.label}${tool.hotkey ? ` (${tool.hotkey})` : ""}`}
    >
      <span className={styles.tileGlyph}>
        <ToolGlyph name={tool.glyph} />
      </span>
      {width !== "rail" && (
        <span className={styles.tileLabel}>{tool.label}</span>
      )}
      {width === "named" && tool.hotkey && (
        <span className={styles.tileHotkey}>{tool.hotkey}</span>
      )}
      {/* Corner triangle — active tool with a flyout (§5.1) */}
      {active && tool.hasFlyout && <span className={styles.tileCornerTriangle} />}
    </button>
  );
}
