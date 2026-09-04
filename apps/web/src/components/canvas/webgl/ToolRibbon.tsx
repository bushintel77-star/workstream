"use client";

/**
 * Landscape Canvas v2 — the categorical vertical tool ribbon (handoff §5).
 *
 * Milled chassis, hand-opposite edge, top-aligned at inset 30px. Five groups
 * (DRAW, GRADE, PLANT, BUILD, MEASURE) + a utility row (Layers, History).
 *
 * Three widths, chosen for the user (no manual collapse):
 *   RAIL 56px  — while the pen is down (pen-down quiet state, §5.5)
 *   STANDARD 88px — at rest (icon-only, no text labels)
 *   NAMED 236px — on hover or Cmd+K (adds names + hotkeys)
 *
 * Width transitions are a 50ms CSS transform in the DOM overlay — the WebGL
 * rendering loop is never involved. XState v5 enforces a strict binary toggle:
 * the ribbon is either COLLAPSED or DEPLOYED, with no elastic bounce.
 *
 * Active tool: stark white fill, dark ink, inset shadow (depressed switch).
 */

import { useCallback, useEffect } from "react";
import { useMachine } from "@xstate/react";
import { useStudioStore, type ToolId } from "./studioStore";
import { isToolLocked, toolLockReason } from "./chromeContract";
import { ribbonMachine, widthFromState, type RibbonWidth } from "./ribbonMachine";
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
      // No flyout yet: ToolFlyout's FLYOUT_TOOLS doesn't cover CONTOUR
      // (its spec'd variant/interval/max-slope panel isn't built — see
      // docs/MENTAL-CANVAS-ROADMAP.md Phase M for material/dash work). Don't show the corner-triangle
      // "has a flyout" affordance for a control that doesn't exist yet
      // (honesty contract, ToolFlyout.tsx's own §0.1 comment).
      { id: "contour", label: "CONTOUR", hotkey: "C", glyph: "contour" },
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

/* ---- inline SVG glyphs (handoff §10: no icon set, inline line SVGs) ----
 * Hardware-grade specification:
 *   - 28px display grid (large-scale engineering engraving hit-target)
 *   - strokeWidth 2 (static — does NOT scale with the grid; a 2px stroke
 *     on a 28px box reads as a precise thin engraving, not an oversized toy)
 *   - strokeLinecap square (mechanical termination — no soft round caps)
 *   - strokeLinejoin miter (precision corners — no soft radii)
 *   - State inversion: resting = stark stroke against dark panel;
 *     active (depressed) = solid fill, no stroke. The `filled` prop
 *     switches the entire glyph to fill mode for the active state. */

function ToolGlyph({ name, filled = false }: { name: string; filled?: boolean }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: filled ? "currentColor" : "none",
    stroke: filled ? "none" : "currentColor",
    strokeWidth: 2,
    strokeLinecap: "square" as const,
    strokeLinejoin: "miter" as const,
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
  const setRibbonDwellOpen = useStudioStore((s) => s.setRibbonDwellOpen);
  // Phase L.5 — GRADE + MEASURE lock in 3D per the chrome contract. The
  // contract is read per-group in the render below (isLocked + lockReason),
  // not pre-computed here, so the lock state is driven by the contract data
  // table — not scattered conditionals.
  const cameraPreset = useStudioStore((s) => s.cameraPreset);

  // XState v5 binary toggle: COLLAPSED ↔ DEPLOYED, with RAIL for pen-down.
  // No dwell timer, no easing — the statechart enforces instant binary
  // transitions, and the 50ms CSS transform handles the visual snap.
  const [state, send] = useMachine(ribbonMachine);

  // Sync penDown from the store into the machine
  useEffect(() => {
    send({ type: penDown ? "PEN_DOWN" : "PEN_UP" });
  }, [penDown, send]);

  // Cmd+K toggles deployment
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        send({ type: "CMD_K_TOGGLE" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [send]);

  const onPointerEnter = useCallback(() => {
    send({ type: "HOVER_ENTER" });
  }, [send]);

  const onPointerLeave = useCallback(() => {
    send({ type: "HOVER_LEAVE" });
  }, [send]);

  // Keep the store in sync for components that read ribbonDwellOpen
  useEffect(() => {
    setRibbonDwellOpen(state.matches("deployed"));
  }, [state, setRibbonDwellOpen]);

  // Width from the statechart state — the single source of truth
  const width: RibbonWidth = widthFromState(state.value as string);

  const isLeft = handedness === "LEFT";
  const sideClass = isLeft ? styles.ribbonLeft : styles.ribbonRight;
  const widthClass =
    width === "rail"
      ? styles.ribbonRail
      : width === "deployed"
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
      {/* Header — only in deployed (expanded) width */}
      {width === "deployed" && (
        <div className={styles.header}>
          <span className={styles.headerLabel}>TOOLS</span>
        </div>
      )}

      {/* Group pips — only in deployed (expanded) width */}
      {width === "deployed" && (
        <div className={styles.groupPips}>
          {TOOL_GROUPS.slice(0, 3).map((g) => (
            <span
              key={g.name}
              className={`${styles.pip} ${activeGroupName === g.name ? styles.pipActive : ""}`}
            />
          ))}
        </div>
      )}

      {/* Tool groups — icon-only at standard/rail, labels only at named */}
      {TOOL_GROUPS.map((group, gi) => {
        const locked = group.tools.some((t) => isToolLocked(t.id, cameraPreset));
        const reason = locked
          ? group.tools.reduce<string | null>(
            (r, t) => r ?? toolLockReason(t.id, cameraPreset),
            null,
          )
          : null;
        return (
          <div key={group.name} className={styles.group} data-locked={locked ? "true" : undefined}>
            {/* Chassis gap between groups (not a drawn line) */}
            {gi > 0 && <div className={styles.chassisGap} />}

            {/* Group header — only in deployed width; at rail only active group */}
            {(width === "deployed" || (width === "rail" && activeGroupName === group.name)) && (
              <div
                className={`${styles.groupHeader} ${activeGroupName === group.name ? styles.groupHeaderActive : ""} ${width === "rail" ? styles.groupHeaderRail : ""} ${locked ? styles.groupHeaderLocked : ""}`}
              >
                {group.name}
                {locked && (
                  <span className={styles.lockGlyph} data-testid={`lock-${group.name.toLowerCase()}`}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                )}
              </div>
            )}

            {/* Lock reason — one stated reason for the group (spec 11c).
                Rendered OUT OF FLOW: spec §11c's first rule is that nothing
                in the chrome changes position between camera states, and an
                in-flow reason line grew the ribbon's height in 3D. It is
                drawn at every width, including rail, so a refused hotkey
                always has its reason on screen. */}
            {locked && reason && (
              <div
                className={styles.lockReason}
                data-testid={`lock-reason-${group.name.toLowerCase()}`}
                role="note"
              >
                {reason}
              </div>
            )}

            {/* Tool tiles */}
            {group.tools.map((tool) => (
              <ToolTile
                key={tool.id}
                tool={tool}
                active={activeTool === tool.id}
                width={width}
                disabled={locked}
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
        );
      })}

      {/* Utility row — Layers + History, isolated at the bottom */}
      <div className={styles.chassisGap} />
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
  width: RibbonWidth;
  compact?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolTile({ tool, active, width, compact, disabled, onClick }: ToolTileProps) {
  const className = [
    styles.tile,
    active ? styles.tileActive : "",
    compact ? styles.tileCompact : "",
    width === "rail" ? styles.tileRail : "",
    disabled ? styles.tileLocked : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={className}
      data-tool-id={tool.id}
      data-active={active}
      data-locked={disabled ? "true" : undefined}
      disabled={disabled}
      onClick={onClick}
      title={`${tool.label}${tool.hotkey ? ` (${tool.hotkey})` : ""}${disabled ? " — locked" : ""}`}
    >
      <span className={styles.tileGlyph}>
        <ToolGlyph name={tool.glyph} filled={active} />
      </span>
      {/* Labels only in deployed (expanded) width — standard is icon-only */}
      {width === "deployed" && (
        <span className={styles.tileLabel}>{tool.label}</span>
      )}
      {width === "deployed" && tool.hotkey && (
        <span className={styles.tileHotkey}>{tool.hotkey}</span>
      )}
      {/* Corner triangle — active tool with a flyout (§5.1) */}
      {active && tool.hasFlyout && <span className={styles.tileCornerTriangle} />}
    </button>
  );
}
