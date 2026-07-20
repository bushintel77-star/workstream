"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BY_TYPE, type StudioItemType } from "../../studioCatalog";
import css from "./commandPalette.module.css";

export type StudioCommand = {
  id: string;
  label: string;
  detail: string;
  keywords: string;
  run: () => void;
};

type Props = {
  open: boolean;
  query: string;
  onQuery: (q: string) => void;
  onClose: () => void;
  onAskAi: (query: string) => void;
  onArm: (t: StudioItemType) => void;
  onScanGhosts: () => void;
  onConvertSketch?: () => void;
  onToggleFitSheet: () => void;
  onGoQuote: () => void;
  onToggleFocus: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

function matches(cmd: StudioCommand, q: string) {
  if (!q.trim()) return true;
  const hay = `${cmd.label} ${cmd.detail} ${cmd.keywords}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => hay.includes(tok));
}

export function StudioCommandPalette({
  open,
  query,
  onQuery,
  onClose,
  onAskAi,
  onArm,
  onScanGhosts,
  onConvertSketch,
  onToggleFitSheet,
  onGoQuote,
  onToggleFocus,
  onUndo,
  onRedo,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);

  const commands = useMemo<StudioCommand[]>(() => {
    const base: StudioCommand[] = [
      {
        id: "ask-ai",
        label: query.trim() ? `Ask AI: ${query.trim()}` : "Ask AI (design loop)",
        detail: "Central assist — geometry-aware proposals merge into the draft until you accept",
        keywords: "ai assist ask natural language coach",
        run: () => onAskAi(query.trim() || "shade the west glazing"),
      },
      {
        id: "title-boundary",
        label: "Title boundary",
        detail: "Snap Vicmap title, clear aerial noise, charcoal boundary with dims",
        keywords:
          "title boundary cadastral foundation vicmap aerial purge vegetation land records stage",
        run: () =>
          onAskAi(
            "title boundary — Vicmap parcel, clear aerial",
          ),
      },
      {
        id: "spatial-correction",
        label: "Spatial correction (cadastral + sieve)",
        detail:
          "Snap Vicmap title boundary, sieve overlapping trees, clamp elevation, drop aerial to parchment",
        keywords:
          "spatial correction cadastral vicmap snap title sieve vegetation aerial parchment elevation",
        run: () =>
          onAskAi(
            "spatial correction — snap to Vicmap title, sieve vegetation, drop aerial",
          ),
      },
      {
        id: "scan-ghosts",
        label: "Scan site (AI propose)",
        detail: "Run the studio AI engine over lot geometry and aerial cues",
        keywords: "scan ghost ai suggest propose layout",
        run: onScanGhosts,
      },
      ...(onConvertSketch
        ? [
            {
              id: "convert-sketch",
              label: "Convert sketch to CAD",
              detail:
                "Turn freehand strokes into site-anchored assets — clear of setback and house envelope",
              keywords:
                "convert sketch cad stroke ink deck hedge canopy paving bed lawn drain auto",
              run: onConvertSketch,
            } satisfies StudioCommand,
          ]
        : []),
      {
        id: "fit-sheet",
        label: "Toggle Fit sheet",
        detail: "A3/A4 cream paper working drawing with schedule",
        keywords: "fit sheet a3 a4 paper frame",
        run: onToggleFitSheet,
      },
      {
        id: "quote",
        label: "Open quote",
        detail: "Live BOM and Tier-1 value ledger",
        keywords: "quote bom price tier1",
        run: onGoQuote,
      },
      {
        id: "focus",
        label: "Quiet canvas",
        detail: "Temporarily clear docks — instruments still awaken on approach",
        keywords: "focus chrome hide quiet",
        run: onToggleFocus,
      },
      {
        id: "undo",
        label: "Undo",
        detail: "Revert last mutate",
        keywords: "undo history",
        run: onUndo,
      },
      {
        id: "redo",
        label: "Redo",
        detail: "Restore undone mutate",
        keywords: "redo history",
        run: onRedo,
      },
    ];

    const arm: StudioCommand[] = (
      Object.keys(BY_TYPE) as StudioItemType[]
    )
      .filter((t) => !BY_TYPE[t].existing)
      .map((t) => ({
        id: `arm-${t}`,
        label: `Place ${BY_TYPE[t].name}`,
        detail: "Arm Add tool — click plan to place",
        keywords: `${BY_TYPE[t].name} ${BY_TYPE[t].tag} add place`,
        run: () => onArm(t),
      }));

    return [...base, ...arm];
  }, [
    onArm,
    onAskAi,
    onConvertSketch,
    onGoQuote,
    onRedo,
    onScanGhosts,
    onToggleFitSheet,
    onToggleFocus,
    onUndo,
    query,
  ]);

  const filtered = useMemo(
    () => commands.filter((c) => matches(c, query)),
    [commands, query],
  );

  useEffect(() => {
    if (!open) return;
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const runAt = (idx: number) => {
    const cmd = filtered[idx];
    if (!cmd) return;
    cmd.run();
    onClose();
  };

  return (
    <div className={css.backdrop} data-testid="canvas-command-palette" onClick={onClose}>
      <div
        className={css.panel}
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(filtered.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            runAt(active);
          }
        }}
      >
        <input
          ref={inputRef}
          className={css.input}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Ask AI or run a command…"
          aria-label="Command search"
        />
        <ul className={css.list}>
          {filtered.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                type="button"
                className={css.row}
                role="option"
                data-testid={`canvas-command-${cmd.id}`}
                data-active={i === active ? "true" : "false"}
                onMouseEnter={() => setActive(i)}
                onClick={() => runAt(i)}
              >
                <span className={css.label}>{cmd.label}</span>
                <span className={css.detail}>{cmd.detail}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className={css.empty}>No matching commands</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
