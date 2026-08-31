"use client";

/**
 * Gold Standard 2026 — Spatial Command Palette (Cmd/Ctrl+K).
 *
 * A global teleporter. Searches existing projects by address and pings
 * Nominatim for new sites. Selecting an existing project jumps to its canvas;
 * selecting an address creates a new project, routes to it, and appends
 * ?setup=1 so the WebGL mount triggers the Phase 7 auto-generation.
 *
 * Commands (modes/tools/views) remain as a fallback filter group.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useStudioStore } from "./studioStore";
import { OBLIQUE_PITCH_DEG } from "./cameraRig";
import type { CanvasMode } from "../../../lib/canvas-mode";
import type { Project } from "@workstream/contracts";
import {
  listProjectsAction,
  geocodeSearchAction,
  createProjectAction,
} from "../../../app/actions";

type Suggestion = {
  id: string;
  place_name: string;
  text: string;
  lat: number;
  lng: number;
};

type PaletteAction = {
  id: string;
  label: string;
  group: "Mode" | "Tool" | "View" | "Edit";
  hint?: string;
  run: () => void;
};

type PaletteItem =
  | { kind: "project"; id: string; project: Project }
  | { kind: "address"; id: string; suggestion: Suggestion }
  | { kind: "command"; id: string; command: PaletteAction };

const chip: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-xs)",
  letterSpacing: "0.06em",
  padding: "1px 7px",
  borderRadius: "var(--gs-radius-pill)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
  color: "var(--la-ink-secondary)",
  whiteSpace: "nowrap",
};

const chipAccent = (colour: string): React.CSSProperties => ({
  ...chip,
  color: colour,
  border: `1px solid color-mix(in srgb, ${colour} 45%, transparent)`,
});

function labelForSuggestion(item: Suggestion): string {
  const first = item.place_name.split(",").slice(0, 3).join(",").trim();
  if (!item.text || /^\d+$/.test(item.text.trim())) return first || item.place_name;
  if (item.place_name.toLowerCase().startsWith(item.text.toLowerCase())) {
    return first || item.place_name;
  }
  return `${item.text} — ${first}`;
}

export function StudioCommandPalette({
  open,
  onClose,
  onMode,
  onZoom,
  onOpenSitePhotos,
  projectId,
  unlocked,
}: {
  open: boolean;
  onClose: () => void;
  onMode: (mode: CanvasMode) => void;
  onZoom: (direction: 1 | -1) => void;
  onOpenSitePhotos: () => void;
  projectId: string;
  unlocked: ReadonlySet<CanvasMode>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [addresses, setAddresses] = useState<Suggestion[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  useFocusTrap(open, panelRef, onClose);

  const actions = useMemo<PaletteAction[]>(() => {
    const modes: Array<[CanvasMode, string]> = [
      ["survey", "Survey — site truth checklist"],
      ["sketch", "Sketch — freehand ink (2D + 3D)"],
      ["cad", "CAD — technical plan + AI drafter"],
      ["elevation", "Elevation — N/E/S/W sheet"],
      ["garden", "Garden — eye-level 3D viewpoints"],
      ["quote", "Quote — itemized fit-sheet"],
      ["present", "Present — presentation lens"],
      ["share", "Share — client portal"],
    ];
    const tool = (
      id: string,
      label: string,
      toggle: () => void,
    ): PaletteAction => ({
      id: `tool-${id}`,
      label,
      group: "Tool",
      hint: "toggle",
      run: toggle,
    });
    const store = useStudioStore.getState();
    return [
      ...modes.filter(([mode]) => unlocked.has(mode)).map<PaletteAction>(([mode, label]) => ({
        id: `mode-${mode}`,
        label,
        group: "Mode",
        hint: {
          survey: "Shift+1",
          sketch: "Shift+2",
          cad: "Shift+3",
          elevation: "Shift+4",
          garden: "Shift+5",
          quote: "Shift+6",
          present: "Shift+7",
          share: "Shift+8",
        }[mode],
        run: () => onMode(mode),
      })),
      {
        id: "tool-sketch",
        label: "Sketch ink",
        group: "Tool",
        hint: "S",
        run: () => {
          store.setArmedSymbolId(null);
          store.setMeasureActive(false);
          store.setSketchMode(!useStudioStore.getState().sketchMode);
        },
      },
      tool("tidy", "Tidy strokes to CAD proposals", () => {
        useStudioStore.getState().tidySketchToCad();
      }),
      tool("convert-cad", "Convert strokes to CAD features", () => {
        useStudioStore.getState().convertStrokesToCadFeatures();
      }),
      {
        id: "tool-measure",
        label: "Measure tape",
        group: "Tool",
        hint: "M",
        run: () => store.setMeasureActive(!useStudioStore.getState().measureActive),
      },
      {
        id: "tool-assets",
        label: "Asset library",
        group: "Tool",
        hint: "A",
        run: () => store.setAssetsOpen(!useStudioStore.getState().assetsOpen),
      },
      {
        id: "tool-underground",
        label: "Subsurface view",
        group: "Tool",
        hint: "U",
        run: () => store.setSubsurfaceView(!useStudioStore.getState().subsurfaceView),
      },
      tool("split", "Split plan | 3D", () =>
        store.setSplitView(!useStudioStore.getState().splitView),
      ),
      {
        id: "tool-dims",
        label: "Working-drawing dims",
        group: "Tool",
        hint: "D",
        run: () => store.setDimsView(!useStudioStore.getState().dimsView),
      },
      tool("quote", "Fit-sheet", () =>
        store.setFitSheetOpen(!useStudioStore.getState().fitSheetOpen),
      ),
      {
        id: "tool-site-photos",
        label: "Site photos — trace an elevation from a photo",
        group: "Tool",
        hint: "opens",
        run: onOpenSitePhotos,
      },
      {
        id: "trench-drainage",
        label: "Trace trench — drainage",
        group: "Tool",
        run: () => store.setTrenchTool("drainage"),
      },
      {
        id: "trench-irrig-main",
        label: "Trace trench — irrigation main",
        group: "Tool",
        run: () => store.setTrenchTool("irrig_main"),
      },
      {
        id: "trench-irrig-lateral",
        label: "Trace trench — irrigation lateral",
        group: "Tool",
        run: () => store.setTrenchTool("irrig_lateral"),
      },
      {
        id: "trench-lighting",
        label: "Trace trench — lighting conduit",
        group: "Tool",
        run: () => store.setTrenchTool("lighting_conduit"),
      },
      {
        id: "zone-drip",
        label: "Trace zone — drip",
        group: "Tool",
        run: () => store.setZoneTool("drip"),
      },
      {
        id: "zone-spray",
        label: "Trace zone — spray",
        group: "Tool",
        run: () => store.setZoneTool("spray"),
      },
      {
        id: "zone-lighting",
        label: "Trace lighting run",
        group: "Tool",
        run: () => store.setZoneTool("lighting"),
      },
      {
        id: "view-plan",
        label: "Plan view (orthographic)",
        group: "View",
        hint: "1",
        run: () => store.setPitchDeg(0),
      },
      {
        id: "view-3d",
        label: "3D view (perspective)",
        group: "View",
        hint: "2",
        run: () => store.setPitchDeg(OBLIQUE_PITCH_DEG),
      },
      {
        id: "view-zoom-in",
        label: "Zoom in",
        group: "View",
        run: () => onZoom(1),
      },
      {
        id: "view-zoom-out",
        label: "Zoom out",
        group: "View",
        run: () => onZoom(-1),
      },
      {
        id: "edit-undo",
        label: "Undo",
        group: "Edit",
        hint: "Ctrl+Z",
        run: () => useStudioStore.getState().undo(),
      },
      {
        id: "edit-redo",
        label: "Redo",
        group: "Edit",
        hint: "Ctrl+Shift+Z",
        run: () => useStudioStore.getState().redo(),
      },
      {
        id: "view-subsurface-studio",
        label: "Subsurface studio — full-screen 3D underground",
        group: "View",
        hint: "opens",
        run: () => window.location.assign(`/subsurface-studio/${projectId}`),
      },
    ];
  }, [onMode, onOpenSitePhotos, onZoom, projectId, unlocked]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    setAddresses([]);
    setProjects([]);
    setProjectsLoading(true);
    requestAnimationFrame(() => inputRef.current?.focus());

    let cancelled = false;
    listProjectsAction()
      .then((list) => {
        if (cancelled) return;
        const sorted = list
          .slice()
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
          .slice(0, 5);
        setProjects(sorted);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[palette] list projects failed", err);
      })
      .finally(() => setProjectsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setAddresses([]);
      setAddressesLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setAddressesLoading(true);
    const requestId = ++requestIdRef.current;

    debounceRef.current = setTimeout(() => {
      geocodeSearchAction(trimmed)
        .then((results) => {
          if (requestId !== requestIdRef.current) return;
          setAddresses(results);
        })
        .catch((err) => {
          if (requestId !== requestIdRef.current) return;
          console.error("[palette] geocode failed", err);
        })
        .finally(() => setAddressesLoading(false));
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => setActiveIdx(0), [query, projects, addresses]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const out: PaletteItem[] = [];

    const projectMatch = (project: Project) => {
      if (!q) return true;
      const hay = [
        project.address,
        project.client_name ?? "",
        project.status,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    };

    const projectItems = q
      ? projects.filter(projectMatch)
      : projects.slice(0, 5);
    for (const project of projectItems) {
      out.push({ kind: "project", id: `project-${project.id}`, project });
    }

    for (const suggestion of addresses) {
      out.push({ kind: "address", id: `address-${suggestion.id}`, suggestion });
    }

    const filteredCommands = q
      ? actions.filter(
        (a) =>
          a.label.toLowerCase().includes(q) ||
          a.group.toLowerCase().includes(q),
      )
      : actions;
    for (const command of filteredCommands) {
      out.push({ kind: "command", id: command.id, command });
    }

    return out;
  }, [actions, addresses, projects, query]);

  useEffect(() => {
    if (activeIdx >= items.length && items.length > 0) {
      setActiveIdx(items.length - 1);
    }
  }, [activeIdx, items.length]);

  const runAt = (i: number) => {
    const item = items[i];
    if (!item) return;
    if (item.kind === "command") {
      item.command.run();
      onClose();
    } else if (item.kind === "project") {
      router.push(`/projects/${item.project.id}`);
      onClose();
    } else if (item.kind === "address") {
      void createFromAddress(item.suggestion);
    }
  };

  async function createFromAddress(suggestion: Suggestion) {
    if (creating) return;
    setCreating(true);
    try {
      const formData = new FormData();
      formData.set("address", suggestion.place_name);
      formData.set("lat", String(suggestion.lat));
      formData.set("lng", String(suggestion.lng));
      const project = await createProjectAction(formData);
      router.push(`/projects/${project.id}?setup=1`);
    } catch (err) {
      console.error("[palette] create project failed", err);
    } finally {
      setCreating(false);
      onClose();
    }
  }

  if (!open) return null;

  const busy = projectsLoading || addressesLoading || creating;

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        top: 110,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(520px, 92vw)",
        pointerEvents: "auto",
        borderRadius: "var(--gs-radius-panel)",
        background: "color-mix(in srgb, var(--la-surface) 55%, transparent)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid color-mix(in srgb, var(--gs-line) 40%, transparent)",
        boxShadow: "0 12px 40px color-mix(in srgb, var(--gs-frame) 75%, transparent)",
        fontFamily: "var(--font-ui)",
        color: "var(--la-ink)",
        overflow: "hidden",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      data-testid="studio-command-palette"
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        aria-label="Search projects, addresses or commands"
        data-testid="command-palette-input"
        placeholder={
          busy && creating
            ? "Creating new site…"
            : "Search projects, type an address, or run a command…"
        }
        disabled={creating}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            runAt(activeIdx);
          }
        }}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          fontFamily: "var(--font-ui)",
          fontSize: "var(--gs-font-sub)",
          color: "var(--la-ink)",
          background: "transparent",
          border: "none",
          borderBottom: "1px solid color-mix(in srgb, var(--gs-line) 40%, transparent)",
          opacity: creating ? 0.6 : 1,
        }}
      />
      <div role="listbox" aria-label="Palette results" style={{ maxHeight: 360, overflowY: "auto" }}>
        {items.length === 0 ? (
          <p
            style={{
              padding: "10px 12px",
              fontSize: "var(--gs-font-md)",
              color: "var(--la-ink-secondary)",
              margin: 0,
            }}
          >
            {busy && !query ? "Loading projects…" : "No matches."}
          </p>
        ) : (
          items.map((item, i) => {
            const active = i === activeIdx;
            const baseStyle: React.CSSProperties = {
              display: "flex",
              alignItems: "center",
              gap: "var(--gs-space-4)",
              padding: "6px 12px",
              fontSize: "var(--gs-font-md)",
              cursor: "pointer",
              background: active
                ? "color-mix(in srgb, var(--la-accent) 14%, transparent)"
                : "transparent",
              color: active ? "var(--la-accent)" : "var(--la-ink)",
            };

            if (item.kind === "project") {
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={active}
                  data-testid={`palette-project-${item.project.id}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => runAt(i)}
                  style={baseStyle}
                >
                  <span style={chipAccent("var(--la-accent)")}>Project</span>
                  <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <span>{item.project.client_name || item.project.address}</span>
                    <span
                      style={{
                        fontSize: "var(--gs-font-sm)",
                        color: "var(--la-ink-secondary)",
                      }}
                    >
                      {item.project.address}
                    </span>
                  </span>
                  <span style={chip}>
                    {new Date(item.project.created_at).toLocaleDateString("en-AU")}
                  </span>
                </div>
              );
            }

            if (item.kind === "address") {
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={active}
                  data-testid={`palette-address-${item.suggestion.id}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => runAt(i)}
                  style={baseStyle}
                >
                  <span style={chipAccent("var(--la-success)")}>Create site</span>
                  <span style={{ flex: 1 }}>{labelForSuggestion(item.suggestion)}</span>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                role="option"
                aria-selected={active}
                data-testid={`command-${item.command.id}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => runAt(i)}
                style={baseStyle}
              >
                <span style={chip}>{item.command.group}</span>
                <span style={{ flex: 1 }}>{item.command.label}</span>
                {item.command.hint ? <span style={chip}>{item.command.hint}</span> : null}
              </div>
            );
          })
        )}
        {addressesLoading || projectsLoading ? (
          <p
            style={{
              padding: "8px 12px",
              fontSize: "var(--gs-font-sm)",
              color: "var(--la-ink-secondary)",
              margin: 0,
            }}
          >
            {addressesLoading ? "Searching addresses…" : "Loading projects…"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
