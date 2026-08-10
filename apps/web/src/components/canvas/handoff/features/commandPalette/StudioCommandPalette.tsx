"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { BydaAssetKind } from "@workstream/contracts";
import {
  BY_TYPE,
  type StudioItemType,
  type StudioMode,
} from "../../studioCatalog";
import { BYDA_KIND_LABEL } from "../../geometry/bydaPlanStyles";
import { rankAssetCommands } from "../assetPanel/assetCommandRank";
import { useFocusTrap } from "@/lib/use-focus-trap";
import css from "./commandPalette.module.css";

/** Tier-1 Cmd+K catalogue groups (designer inventory). */
export type StudioCommandGroup =
  | "AI"
  | "Site"
  | "BYDA"
  | "Design"
  | "View"
  | "Place";

const GROUP_ORDER: StudioCommandGroup[] = [
  "AI",
  "Site",
  "BYDA",
  "Design",
  "View",
  "Place",
];

export type StudioCommand = {
  id: string;
  label: string;
  detail: string;
  keywords: string;
  group?: StudioCommandGroup;
  run: () => void;
};

function commandGroup(cmd: StudioCommand): StudioCommandGroup {
  if (cmd.group) return cmd.group;
  const id = cmd.id;
  if (id.startsWith("arm-")) return "Place";
  if (id.startsWith("byda-")) return "BYDA";
  if (
    id === "ask-ai" ||
    id === "scan-ghosts" ||
    id === "develop-site" ||
    id === "scan-canopy" ||
    id === "propose-services" ||
    id === "auto-trench"
  ) {
    return "AI";
  }
  if (
    id === "title-boundary" ||
    id === "spatial-correction" ||
    id === "prepare-site-pack" ||
    id === "services-ledger" ||
    id === "environment" ||
    id === "site-meta" ||
    id === "trees-meta"
  ) {
    return "Site";
  }
  if (
    id === "convert-sketch" ||
    id === "annotate" ||
    id === "lifecycle-phase" ||
    id === "irrigation-uniformity" ||
    id === "live-telemetry" ||
    id === "ar-birdseye" ||
    id === "buildable-area" ||
    id === "save-scheme" ||
    id === "quote" ||
    id === "measures" ||
    id === "design-branches" ||
    id === "ops-schedules" ||
    id === "planner-assist" ||
    id === "structured-tools"
  ) {
    return "Design";
  }
  return "View";
}

type Props = {
  open: boolean;
  query: string;
  onQuery: (q: string) => void;
  onClose: () => void;
  onAskAi: (query: string) => void;
  onArm: (t: StudioItemType) => void;
  /** Session place recents — feeds deterministic asset ranking. */
  recentAssetTypes?: StudioItemType[];
  /** Mode boost for planting / hardscape ranking. */
  mode?: StudioMode;
  onScanGhosts: () => void;
  /** Propose irrig / conduit / drainage trenches from zones + drains. */
  onAutoTrench?: () => void;
  /** Agentic-lite Develop loop — ghosts → scheme tip → Flora → Live BOM. */
  onDevelopSite?: () => void;
  /** Job intake — title + KEYLESS + urban trees + chase list. */
  onPrepareSitePack?: () => void;
  /** LV conduit + watering (agg drain or spray laterals). */
  onProposeServices?: () => void;
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
  /** Summon / dismiss the board ink legend (existing / proposed / BYDA). */
  onToggleInkLegend?: () => void;
  onGoQuote: () => void;
  onToggleFocus: () => void;
  /** Tilt lens — animates to the settle angle (view-only). */
  onTiltView?: () => void;
  /** Named cardinal garden axon (Looking N/S/E/W). */
  onGardenViewpoint?: (look: "N" | "S" | "E" | "W") => void;
  /** Snapshot current design as scheme A/B/C (filmstrip only after save). */
  onSaveScheme?: () => void;
  /** Canvas-first: summon / dismiss the measures + quantity lane. */
  dataOpen: boolean;
  onToggleData: () => void;
  onUndo: () => void;
  onRedo: () => void;
  /** Arm hand-lettered annotation placement (next click on plan). */
  onAnnotate?: () => void;
  /** Fit outdoor / selection camera (zoom column removed). */
  onZoomToFit?: () => void;
  /** Toggle indicative spray DU wash. */
  onToggleIrrigationUniformity?: () => void;
  /** Toggle live twin telemetry overlay. */
  onToggleLiveTelemetry?: () => void;
  /** Toggle on-site bird's-eye AR overlay. */
  onToggleArBirdseye?: () => void;
  /** Toggle buildable area envelope (setbacks + TPZ + easements). */
  onToggleBuildableArea?: () => void;
  /** Trigger a one-shot canopy scan from the loaded aerial. */
  onScanCanopy?: () => void;
  /** Summon the pointer-mark settings sheet (drawing cursor). */
  onPointerSettings?: () => void;
  /** Open the Plan artboard viewport. */
  onArtboardPlan?: () => void;
  /** Cycle ASLA/SILA lifecycle phase. */
  onCycleLifecyclePhase?: () => void;
  /** Open async design branch switcher (VCS). */
  onOpenDesignBranches?: () => void;
  /** Summon Instant Planner assist panel (sketch→CAD / irrigation / leftovers). */
  onOpenPlannerAssist?: () => void;
  /** Summon structured ditch/path/wall/bed tools. */
  onOpenStructuredTools?: () => void;
  /** Open landscape-ops schedules dock. */
  onOpenOpsSchedules?: () => void;
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
  recentAssetTypes = [],
  mode = "sketch",
  onScanGhosts,
  onAutoTrench,
  onDevelopSite,
  onPrepareSitePack,
  onProposeServices,
  onOpenServices,
  onOpenEnvironment,
  onOpenSite,
  onOpenTrees,
  onArmByda,
  onConvertSketch,
  onToggleFitSheet,
  onToggleInkLegend,
  onGoQuote,
  onToggleFocus,
  onTiltView,
  onGardenViewpoint,
  onSaveScheme,
  dataOpen,
  onToggleData,
  onUndo,
  onRedo,
  onAnnotate,
  onZoomToFit,
  onToggleIrrigationUniformity,
  onToggleLiveTelemetry,
  onToggleArBirdseye,
  onToggleBuildableArea,
  onScanCanopy,
  onPointerSettings,
  onArtboardPlan,
  onCycleLifecyclePhase,
  onOpenDesignBranches,
  onOpenPlannerAssist,
  onOpenStructuredTools,
  onOpenOpsSchedules,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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
      ...(onPrepareSitePack
        ? [
          {
            id: "prepare-site-pack",
            label: "Prepare site pack",
            detail:
              "Vicmap title + KEYLESS washes + urban tree ghosts + chase list (CoT, BYDA, council drain, arbor)",
            keywords:
              "prepare site pack intake title vicmap keyless trees byda council chase survey job hydrate",
            run: onPrepareSitePack,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onDevelopSite
        ? [
          {
            id: "develop-site",
            label: "Develop site",
            detail:
              "Propose layout ghosts, tip for scheme A, Flora Ring, Live BOM — you accept each step",
            keywords:
              "develop site loop agentic ghosts scheme flora bom layout garden",
            run: onDevelopSite,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onProposeServices
        ? [
          {
            id: "propose-services",
            label: "Propose lighting & watering",
            detail:
              "LV conduit trench to house main + aggregate drain or sprinkler laterals",
            keywords:
              "lighting conduit trench fitoff house main irrigation spray sprinkler agg drain watering services",
            run: onProposeServices,
          } satisfies StudioCommand,
        ]
        : []),
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
      ...(onOpenDesignBranches
        ? [
          {
            id: "design-branches",
            label: "Design branches",
            detail:
              "Async design VCS — create Option branches, diff vs Main, merge with Accept",
            keywords:
              "branch checkout merge diff main option vcs version control design branch freeze",
            run: onOpenDesignBranches,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onOpenPlannerAssist
        ? [
          {
            id: "planner-assist",
            label: "Instant Planner assist",
            detail:
              "Convert strokes, first-pass irrigation/lighting, leftovers, presentation pack",
            keywords:
              "instant planner assist convert strokes irrigation lighting leftover presentation pack",
            run: onOpenPlannerAssist,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onOpenStructuredTools
        ? [
          {
            id: "structured-tools",
            label: "Structured tools",
            detail: "Ditch, path, wall, bed — stroke to CAD with live conflict preview",
            keywords:
              "structured tools ditch path wall bed stroke cad conflict micro cost",
            run: onOpenStructuredTools,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onOpenOpsSchedules
        ? [
          {
            id: "ops-schedules",
            label: "Ops schedules",
            detail:
              "Planting, trench dig, lighting VA, material — export CSV / issue pack",
            keywords:
              "planting schedule nursery trench dig lighting va cable material bom csv documentation pack",
            run: onOpenOpsSchedules,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onToggleInkLegend
        ? [
          {
            id: "ink-legend",
            label: "Ink legend",
            detail:
              "Existing / proposed / planting / easement / BYDA stroke colours",
            keywords:
              "ink legend existing proposed planting easement byda colour stroke plan",
            run: onToggleInkLegend,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onCycleLifecyclePhase
        ? [
          {
            id: "lifecycle-phase",
            label: "Cycle design phase",
            detail:
              "ASLA/SILA stage — concept through post-occupancy (soft expected detail)",
            keywords:
              "phase lifecycle asla sila concept design development construction tendering admin occupancy",
            run: onCycleLifecyclePhase,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onToggleIrrigationUniformity
        ? [
          {
            id: "irrigation-uniformity",
            label: "Spray uniformity wash",
            detail:
              "Indicative DU / dry spots over spray zones — confirm pressure on site",
            keywords:
              "irrigation spray uniformity du cu heat map dry wet hydrozone coverage",
            run: onToggleIrrigationUniformity,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onToggleLiveTelemetry
        ? [
          {
            id: "live-telemetry",
            label: "Live telemetry",
            detail:
              "Soil moisture, thermal comfort, flow, sediment — twin samples on the board",
            keywords:
              "telemetry twin iot soil moisture thermal comfort flow sediment sensor live",
            run: onToggleLiveTelemetry,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onToggleArBirdseye
        ? [
          {
            id: "ar-birdseye",
            label: "AR bird's-eye",
            detail:
              "On-site camera overlay with footprint occlusion — calibrate for stakeholder consensus",
            keywords:
              "ar birdseye bird eye occlusion camera overlay site align twin vision",
            run: onToggleArBirdseye,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onToggleBuildableArea
        ? [
          {
            id: "buildable-area",
            label: "Pin buildable area",
            detail:
              "Pin the setback laser — also auto-shows for deck, paving, drain and trench tools",
            keywords:
              "buildable area envelope setback tpz easement compliance footprint boundary pin",
            run: onToggleBuildableArea,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onScanCanopy
        ? [
          {
            id: "scan-canopy",
            label: "Scan canopy from aerial",
            detail:
              "Colour-heuristic canopy detection from the loaded aerial — ghost tree proposals",
            keywords:
              "canopy scan aerial colour heuristic tree detection ghost propose vision",
            run: onScanCanopy,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onPointerSettings
        ? [
          {
            id: "pointer-settings",
            label: "Pointer mark…",
            detail:
              "Choose the idle drafting cursor — hover to preview, click to keep",
            keywords:
              "pointer mark cursor settings spade fork rake crosshair drafting preferences",
            run: onPointerSettings,
          } satisfies StudioCommand,
        ]
        : []),
      ...(onArtboardPlan
        ? [
          {
            id: "artboard-plan",
            label: "Artboard · Plan",
            detail: "Switch to the plan viewport (Sheets strip)",
            keywords: "artboard sheet plan viewport fit elevation",
            run: onArtboardPlan,
          } satisfies StudioCommand,
        ]
        : []),
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
        detail: "Live BOM and value ledger",
        keywords: "quote bom price value ledger",
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
      ...(onGardenViewpoint
        ? (
          [
            ["N", "Looking north", "north"],
            ["E", "Looking east", "east"],
            ["S", "Looking south", "south"],
            ["W", "Looking west", "west"],
          ] as const
        ).map(
          ([look, label, key]) =>
            ({
              id: `looking-${key}`,
              label,
              detail:
                "Cardinal garden axon — yaw + tilt (title north unchanged)",
              keywords: `${label} viewpoint garden tilt axon cardinal ${look}`,
              run: () => onGardenViewpoint(look),
            }) satisfies StudioCommand,
        )
        : []),
      ...(onSaveScheme
        ? [
          {
            id: "save-scheme",
            label: "Save design scheme",
            detail: "Snapshot A/B/C for client comparison — filmstrip appears after save",
            keywords: "scheme save abc variation filmstrip client meeting",
            run: onSaveScheme,
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

    const rankedTypes = rankAssetCommands({
      query,
      recents: recentAssetTypes,
      mode,
    });
    const arm: StudioCommand[] = rankedTypes.map((t) => ({
      id: `arm-${t}`,
      label: `Place ${BY_TYPE[t].name}`,
      detail: "Arm Add tool — click plan to place",
      keywords: `${BY_TYPE[t].name} ${BY_TYPE[t].tag} add place`,
      run: () => onArm(t),
    }));

    // Workflow commands keep substring match; place rows are pre-ranked.
    const workflow = base.filter((c) => matches(c, query));
    const merged = [...workflow, ...arm];
    // Idle catalogue: AI · Site · BYDA · Design · View · Place.
    if (!query.trim()) {
      return merged.sort(
        (a, b) =>
          GROUP_ORDER.indexOf(commandGroup(a)) -
          GROUP_ORDER.indexOf(commandGroup(b)),
      );
    }
    return merged;
  }, [
    dataOpen,
    mode,
    onArm,
    onAskAi,
    onAnnotate,
    onZoomToFit,
    onConvertSketch,
    onGoQuote,
    onRedo,
    onDevelopSite,
    onPrepareSitePack,
    onProposeServices,
    onScanGhosts,
    onAutoTrench,
    onOpenServices,
    onOpenEnvironment,
    onOpenSite,
    onOpenTrees,
    onArmByda,
    onToggleData,
    onToggleFitSheet,
    onToggleInkLegend,
    onToggleFocus,
    onToggleIrrigationUniformity,
    onToggleLiveTelemetry,
    onToggleArBirdseye,
    onToggleBuildableArea,
    onScanCanopy,
    onPointerSettings,
    onArtboardPlan,
    onCycleLifecyclePhase,
    onOpenDesignBranches,
    onOpenPlannerAssist,
    onOpenStructuredTools,
    onOpenOpsSchedules,
    onTiltView,
    onGardenViewpoint,
    onSaveScheme,
    onUndo,
    query,
    recentAssetTypes,
  ]);

  const filtered = commands;

  useEffect(() => {
    if (!open) return;
    setActive(0);
  }, [open]);

  // Esc/trap/autofocus/restore — the input is the first focusable in .panel
  // DOM order, so the hook's generic autofocus lands there. Keep Arrow/Enter
  // nav in the panel's own onKeyDown below.
  useFocusTrap(open, panelRef, onClose);

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

  const activeId =
    filtered[active] != null ? `canvas-command-${filtered[active]!.id}` : undefined;

  return (
    <div className={css.backdrop} data-testid="canvas-command-palette" onClick={onClose}>
      <div
        className={css.panel}
        ref={panelRef}
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
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
          placeholder="Search assets — type to place"
          aria-label="Search assets"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="canvas-command-listbox"
          aria-activedescendant={activeId}
        />
        <ul
          id="canvas-command-listbox"
          className={css.list}
          role="listbox"
          aria-label="Command results"
        >
          {filtered.map((cmd, i) => {
            const group = commandGroup(cmd);
            const prev = i > 0 ? commandGroup(filtered[i - 1]!) : null;
            const showGroup = !query.trim() && group !== prev;
            return (
              <Fragment key={cmd.id}>
                {showGroup ? (
                  <li
                    className={css.group}
                    role="presentation"
                    data-testid={`cmd-group-${group.toLowerCase()}`}
                  >
                    {group}
                  </li>
                ) : null}
                <li role="presentation">
                  <button
                    type="button"
                    id={`canvas-command-${cmd.id}`}
                    className={css.row}
                    role="option"
                    aria-selected={i === active}
                    data-testid={`canvas-command-${cmd.id}`}
                    data-active={i === active ? "true" : "false"}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => runAt(i)}
                  >
                    <span className={css.label}>{cmd.label}</span>
                    <span className={css.detail}>{cmd.detail}</span>
                  </button>
                </li>
              </Fragment>
            );
          })}
          {filtered.length === 0 ? (
            <li className={css.empty} role="option" aria-disabled="true">
              No matching commands
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
