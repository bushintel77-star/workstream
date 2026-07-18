"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogSymbol } from "@workstream/contracts";
import css from "./canvasCommandPalette.module.css";

export type CanvasCommand = {
  id: string;
  label: string;
  detail: string;
  keywords: string;
  run: () => void;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbols: CatalogSymbol[];
  onArmSymbol: (symbol: CatalogSymbol) => void;
  onScanGhosts: () => void;
  onDraftCad: () => void;
  onGoToQuote: () => void;
  onToggleMeasure: () => void;
  measureActive: boolean;
};

function buildCommands(
  symbols: CatalogSymbol[],
  handlers: Pick<
    Props,
    | "onArmSymbol"
    | "onScanGhosts"
    | "onDraftCad"
    | "onGoToQuote"
    | "onToggleMeasure"
    | "measureActive"
  >,
): CanvasCommand[] {
  const base: CanvasCommand[] = [
    {
      id: "scan-ghosts",
      label: "Scan aerial for AI suggestions",
      detail: "Vision + heuristics — ghosts stay ephemeral until you accept",
      keywords: "ai detect ghost scan aerial vision suggest",
      run: handlers.onScanGhosts,
    },
    {
      id: "draft-cad",
      label: "Draft working drawing (AI CAD)",
      detail: "Generate metre geometry on this aerial — review ghosts before accept",
      keywords: "cad draft drawing ai generate",
      run: handlers.onDraftCad,
    },
    {
      id: "go-quote",
      label: "Open quote lens",
      detail: "Live BOM and client quote promotion on the same canvas",
      keywords: "quote price estimate bom promote",
      run: handlers.onGoToQuote,
    },
    {
      id: "toggle-measure",
      label: handlers.measureActive ? "Exit measure tape" : "Measure distance",
      detail: "Indicative metres on the aerial — not survey grade",
      keywords: "measure tape distance scale",
      run: handlers.onToggleMeasure,
    },
  ];

  const symbolCommands = symbols.slice(0, 80).map((sym) => ({
    id: `arm-${sym.id}`,
    label: `Arm ${sym.label}`,
    detail: sym.rate_card_sku
      ? `${sym.rate_card_sku} · ${(sym.default_width_m ?? 1.2).toFixed(1)} m`
      : `${(sym.default_width_m ?? 1.2).toFixed(1)} m brush`,
    keywords: `${sym.id} ${sym.label} ${sym.rate_card_sku ?? ""} ${sym.category} place arm`,
    run: () => handlers.onArmSymbol(sym),
  }));

  return [...base, ...symbolCommands];
}

/** Global Cmd+K command surface for canvas-first operators. */
export function CanvasCommandPalette({
  open,
  onOpenChange,
  symbols,
  onArmSymbol,
  onScanGhosts,
  onDraftCad,
  onGoToQuote,
  onToggleMeasure,
  measureActive,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const commands = useMemo(
    () =>
      buildCommands(symbols, {
        onArmSymbol,
        onScanGhosts,
        onDraftCad,
        onGoToQuote,
        onToggleMeasure,
        measureActive,
      }),
    [
      measureActive,
      onArmSymbol,
      onDraftCad,
      onGoToQuote,
      onScanGhosts,
      onToggleMeasure,
      symbols,
    ],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 12);
    return commands
      .filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.detail.toLowerCase().includes(q) ||
          c.keywords.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const runActive = useCallback(() => {
    const cmd = filtered[activeIdx];
    if (!cmd) return;
    cmd.run();
    onOpenChange(false);
  }, [activeIdx, filtered, onOpenChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        runActive();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered.length, onOpenChange, open, runActive]);

  if (!open) return null;

  return (
    <div
      className={css.backdrop}
      role="presentation"
      onClick={() => onOpenChange(false)}
      data-testid="canvas-command-palette"
    >
      <div
        className={css.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Canvas commands"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className={css.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Place, scan, CAD, quote…"
          aria-label="Search commands and materials"
          autoComplete="off"
        />
        <ul className={css.list} role="listbox">
          {filtered.length === 0 ? (
            <li className={css.empty}>No matching commands</li>
          ) : (
            filtered.map((cmd, i) => (
              <li key={cmd.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIdx}
                  className={`${css.row} ${i === activeIdx ? css.rowActive : ""}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    cmd.run();
                    onOpenChange(false);
                  }}
                >
                  <span className={css.rowLabel}>{cmd.label}</span>
                  <span className={css.rowDetail}>{cmd.detail}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className={css.hint}>
          <kbd>↑↓</kbd> navigate · <kbd>Enter</kbd> run · <kbd>Esc</kbd> close
        </p>
      </div>
    </div>
  );
}
