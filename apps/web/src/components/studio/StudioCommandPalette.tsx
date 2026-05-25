"use client";

import { useEffect, useMemo, useState } from "react";
import { filterCatalogSymbols } from "@workstream/domain";
import type { CatalogSymbol } from "@workstream/contracts";
import type { ToolOverride } from "./studioTypes";
import cp from "./studioCommandPalette.module.css";

export type CommandItem = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  symbols: CatalogSymbol[];
  onTool: (t: ToolOverride) => void;
  onResetView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleRightRail: () => void;
  onToggleFocusMode: () => void;
  onPlaceSymbol: (symbolId: string) => void;
  projectId: string;
};

export function StudioCommandPalette({
  open,
  onClose,
  symbols,
  onTool,
  onResetView,
  onZoomIn,
  onZoomOut,
  onToggleRightRail,
  onToggleFocusMode,
  onPlaceSymbol,
  projectId,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const staticCommands = useMemo<CommandItem[]>(
    () => [
      { id: "select", group: "tools", label: "Select tool", hint: "V", run: () => onTool("select") },
      { id: "draw", group: "tools", label: "Draw zone", hint: "D", run: () => onTool("draw") },
      { id: "place", group: "tools", label: "Place symbol", hint: "P", run: () => onTool("place") },
      { id: "measure", group: "tools", label: "Measure", hint: "M", run: () => onTool("measure") },
      { id: "fit", group: "view", label: "Fit to view", hint: "0", run: onResetView },
      { id: "zin", group: "view", label: "Zoom in", hint: "+", run: onZoomIn },
      { id: "zout", group: "view", label: "Zoom out", hint: "-", run: onZoomOut },
      { id: "rail", group: "view", label: "Toggle right rail", hint: "Tab", run: onToggleRightRail },
      { id: "focus", group: "view", label: "Focus mode", hint: "F", run: onToggleFocusMode },
      {
        id: "overview",
        group: "project",
        label: "Open project overview",
        run: () => {
          window.location.href = `/projects/${projectId}/overview`;
        },
      },
    ],
    [
      onTool,
      onResetView,
      onZoomIn,
      onZoomOut,
      onToggleRightRail,
      onToggleFocusMode,
      projectId,
    ],
  );

  const symbolCommands = useMemo(() => {
    if (!query.trim()) return [];
    const hits = filterCatalogSymbols(symbols, { query: query.trim() }).slice(0, 5);
    return hits.map((sym) => ({
      id: `sym-${sym.id}`,
      group: "symbols",
      label: `Place ${sym.label}`,
      hint: sym.category,
      run: () => onPlaceSymbol(sym.id),
    }));
  }, [query, symbols, onPlaceSymbol]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = staticCommands.filter(
      (c) => !q || c.label.toLowerCase().includes(q) || c.group.includes(q),
    );
    return [...base, ...symbolCommands];
  }, [query, staticCommands, symbolCommands]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) => Math.min(filtered.length - 1, i + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter" && filtered[selected]) {
        e.preventDefault();
        filtered[selected].run();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, selected, onClose]);

  if (!open) return null;

  const groups = ["tools", "view", "symbols", "project"] as const;

  return (
    <div
      className={cp.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
      data-testid="studio-command-palette"
    >
      <div className={cp.card} onClick={(e) => e.stopPropagation()}>
        <div className={cp.searchRow}>
          <span className={cp.searchIcon} aria-hidden>
            ⌕
          </span>
          <input
            className={cp.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands or symbols…"
            autoFocus
          />
        </div>
        <ul className={cp.list}>
          {groups.map((group) => {
            const items = filtered.filter((c) => c.group === group);
            if (items.length === 0) return null;
            return (
              <li key={group}>
                <p className={cp.groupLabel}>{group}</p>
                <ul>
                  {items.map((cmd) => {
                    const idx = filtered.indexOf(cmd);
                    return (
                      <li key={cmd.id}>
                        <button
                          type="button"
                          className={`${cp.item} ${idx === selected ? cp.itemActive : ""}`}
                          onMouseEnter={() => setSelected(idx)}
                          onClick={() => {
                            cmd.run();
                            onClose();
                          }}
                        >
                          <span>{cmd.label}</span>
                          {cmd.hint ? <span className={cp.hint}>{cmd.hint}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
