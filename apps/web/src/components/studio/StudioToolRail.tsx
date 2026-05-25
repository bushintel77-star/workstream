"use client";

import { useStudioChromeOptional } from "./StudioChromeContext";
import type { ToolOverride } from "./studioTypes";
import tr from "./studioToolRail.module.css";

type ToolDef = {
  id: ToolOverride | "layers" | "site" | "command";
  icon: string;
  label: string;
  mode?: ToolOverride;
};

const TOOLS: ToolDef[] = [
  { id: "pan", icon: "✋", label: "Hand", mode: "pan" },
  { id: "select", icon: "↖", label: "Select", mode: "select" },
  { id: "draw", icon: "✎", label: "Draw", mode: "draw" },
  { id: "place", icon: "＋", label: "Place", mode: "place" },
  { id: "measure", icon: "↔", label: "Measure", mode: "measure" },
  { id: "massplant", icon: "▦", label: "Mass plant", mode: "massplant" },
  { id: "irrigation", icon: "◎", label: "Irrigate", mode: "irrigation" },
];

export function StudioToolRail() {
  const chrome = useStudioChromeOptional();
  const expanded = chrome?.railExpanded ?? false;
  const toolOverride = chrome?.toolOverride ?? null;
  const setTool = chrome?.setToolOverride;

  const railClass = `${tr.rail} ${expanded ? tr.railExpanded : tr.railCollapsed}`;

  return (
    <aside className={railClass} aria-label="Tools" data-testid="studio-tool-rail">
      <div className={tr.tools}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tr.toolItem}
            data-mode={t.mode ?? t.id}
            data-active={t.mode !== undefined && toolOverride === t.mode ? "true" : "false"}
            title={t.label}
            aria-label={t.label}
            disabled={!setTool && t.mode !== undefined}
            onClick={() => {
              if (t.mode !== undefined && setTool) setTool(t.mode);
            }}
          >
            <span className={tr.icon} aria-hidden>
              {t.icon}
            </span>
            <span className={tr.label}>{t.label}</span>
          </button>
        ))}
        <div className={tr.divider} role="separator" />
        <button
          type="button"
          className={tr.toolItem}
          title="Layer list"
          aria-label="Layers"
          onClick={() => chrome?.onOpenLayers?.()}
        >
          <span className={tr.icon} aria-hidden>
            ◫
          </span>
          <span className={tr.label}>Layers</span>
        </button>
        <button
          type="button"
          className={tr.toolItem}
          title="Site intelligence"
          aria-label="Site layers"
          onClick={() => chrome?.onOpenSitePanel?.()}
        >
          <span className={tr.icon} aria-hidden>
            ☀
          </span>
          <span className={tr.label}>Site</span>
        </button>
        <button
          type="button"
          className={tr.toolItem}
          title="Command palette (Ctrl+K)"
          aria-label="Command palette"
          onClick={() => chrome?.onOpenCommandPalette?.()}
        >
          <span className={tr.icon} aria-hidden>
            ⌘
          </span>
          <span className={tr.label}>Ctrl+K</span>
        </button>
        <div className={tr.spacer} />
        <button
          type="button"
          className={tr.toolItem}
          title={expanded ? "Collapse rail" : "Expand rail"}
          onClick={() => chrome?.setRailExpanded(!expanded)}
        >
          <span className={tr.icon} aria-hidden>
            {expanded ? "◂" : "▸"}
          </span>
          <span className={tr.label}>{expanded ? "Collapse" : "Expand"}</span>
        </button>
      </div>
    </aside>
  );
}
