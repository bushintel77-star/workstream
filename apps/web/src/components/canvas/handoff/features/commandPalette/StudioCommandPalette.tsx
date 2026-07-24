"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BydaAssetKind } from "@workstream/contracts";
import { BY_TYPE, type StudioItemType } from "../../studioCatalog";
import { BYDA_KIND_LABEL } from "../../geometry/bydaPlanStyles";
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
  /** Propose irrig / conduit / drainage trenches from zones + drains. */
  onAutoTrench?: () => void;
  /** Open the Services ledger (ticks / metrics / focus). */
  onOpenServices?: () => void;
  /** Open Environment boundary panel (sun / season / growth). */
  onOpenEnvironment?: () => void;
  /** Open Site meta panel (lot area / dwelling / easements). */
  onOpenSite?: () => void;
  /** Open existing Trees meta panel (count / DBH / TPZ). */
  onOpenTrees?: () => void;
  /** Arm Servc for a typed BYDA asset stroke (not title easement). */
  onArmByda?: (kind: BydaAssetKind) => void;
  onConvertSketch?: () => void;
  onToggleFitSheet: () => void;
  onGoQuote: () => void;
  onToggleFocus: () => void;
  /** Tilt lens — animates to the settle angle (view-only). */
  onTiltView?: () => void;
  /** Canvas-first: summon / dismiss the measures + quantity lane. */
  dataOpen: boolean;
  onToggleData: () => void;
  onUndo: () => void;
  onRedo: () => void;
  /** Arm hand-lettered annotation placement (next click on plan). */
  onAnnotate?: () => void;
  /** Fit outdoor / selection camera (zoom column removed). */
  onZoomToFit?: () => void;
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
  onAutoTrench,
  onOpenServices,
  onOpenEnvironment,
  onOpenSite,
  onOpenTrees,
  onArmByda,
  onConvertSketch,
  onToggleFitSheet,
  onGoQuote,
  onToggleFocus,
  onTiltView,
  dataOpen,
  onToggleData,
  onUndo,
  onRedo,
  onAnnotate,
  onZoomToFit,
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
      ...(onAnnotate
        ? [
            {
              id: "annotate",
              label: "Annotate",
              detail:
                "Place a hand-lettered note with a leader — click the plan, then type",
              keywords: "annotate note annotation leader hand letter callout",
              run: onAnnotate,
            } satisfies StudioCommand,
          ]
        : []),
      ...(onZoomToFit
        ? [
            {
              id: "zoom-to-fit",
              label: "Zoom to fit",
              detail: "Fit the outdoor working area in the viewport",
              keywords: "zoom fit outdoor camera frame home",
              run: onZoomToFit,
            } satisfies StudioCommand,
          ]
        : []),
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
      ...(onAutoTrench
        ? [
            {
              id: "auto-trench",
              label: "Auto trench…",
              detail:
                "Map irrigation main/laterals, lighting conduit, and drainage dig paths from zones — Accept before dig (BYDA)",
              keywords:
                "auto trench irrigation conduit lighting drainage plumbing excavate dig ag pipe mainline lateral landscape architect",
              run: onAutoTrench,
            } satisfies StudioCommand,
          ]
        : []),
      ...(onOpenServices
        ? [
            {
              id: "services-ledger",
              label: "Services ledger",
              detail:
                "Boundary rail — corridors, easements, RLs, lighting & trenches",
              keywords:
                "services ledger easement corridor level lighting trench utilities byda tick focus isolate sticky",
              run: onOpenServices,
            } satisfies StudioCommand,
          ]
        : []),
      ...(onOpenEnvironment
        ? [
            {
              id: "environment",
              label: "Environment",
              detail:
                "Boundary rail — sun hours, season, growth, shade mesh, 12h cast",
              keywords:
                "environment sun shade season frost heat humidity weather growth mesh cast sticky climate",
              run: onOpenEnvironment,
            } satisfies StudioCommand,
          ]
        : []),
      ...(onOpenSite
        ? [
            {
              id: "site-meta",
              label: "Site",
              detail:
                "Boundary rail — lot area, dwelling, easements (Vicmap ≠ assets)",
              keywords:
                "site lot area boundary parcel cadastral vicmap dwelling easement title outdoor sticky",
              run: onOpenSite,
            } satisfies StudioCommand,
          ]
        : []),
      ...(onOpenTrees
        ? [
            {
              id: "trees-meta",
              label: "Existing trees",
              detail:
                "Boundary rail — survey trees, DBH, indicative AS 4970 TPZ",
              keywords:
                "trees existing survey tree canopy dbh tpz as4970 protected retention vegetation sticky",
              run: onOpenTrees,
            } satisfies StudioCommand,
          ]
        : []),
      ...(onArmByda
        ? (
            [
              "sewer",
              "stormwater",
              "water",
              "gas",
              "power",
              "nbn",
            ] as BydaAssetKind[]
          ).map(
            (kind) =>
              ({
                id: `byda-${kind}`,
                label: `BYDA ${BYDA_KIND_LABEL[kind]}…`,
                detail:
                  "Trace typed underground asset — separate stroke from title easements",
                keywords: `byda ${kind} utility asset dig locate sewer gas power nbn water stormwater`,
                run: () => onArmByda(kind),
              }) satisfies StudioCommand,
          )
        : []),
      ...(onConvertSketch
        ? [
            {
              id: "convert-sketch",
              label: "Formalize sketch to CAD",
              detail:
                "Optional step — turn freehand into site-anchored CAD assets. Tidy sketch keeps it hand-drawn.",
              keywords:
                "formalize convert sketch cad stroke ink deck hedge canopy paving bed lawn drain auto tidy hand-drawn",
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
        id: "measures",
        label: dataOpen
          ? "Hide measures & quantities"
          : "Live measures & quantities",
        detail: dataOpen
          ? "Return to a quiet canvas — the drawing owns the surface"
          : "Summon the compliance + live cost lane over the drawing",
        keywords:
          "measures quantities bom cost compliance data lane sidecar summon hide quiet",
        run: onToggleData,
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
      ...(onTiltView
        ? [
            {
              id: "tilt-view",
              label: "Tilt view",
              detail:
                "View-only 2.5D axonometric preview — editing pauses until Esc",
              keywords: "tilt axonometric 2.5d perspective client preview",
              run: onTiltView,
            } satisfies StudioCommand,
          ]
        : []),
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
    dataOpen,
    onArm,
    onAskAi,
    onAnnotate,
    onZoomToFit,
    onConvertSketch,
    onGoQuote,
    onRedo,
    onScanGhosts,
    onAutoTrench,
    onOpenServices,
    onOpenEnvironment,
    onOpenSite,
    onOpenTrees,
    onArmByda,
    onToggleData,
    onToggleFitSheet,
    onToggleFocus,
    onTiltView,
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
