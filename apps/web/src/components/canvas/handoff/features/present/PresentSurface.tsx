"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { freehandPath } from "@/lib/freehandPath";
import type {
  CreatePresentationDocumentInput,
  ImageLayer,
  PresentationDissectGhost,
  PresentationDocument,
  PresentationPage,
  PresentationPanel,
  PresentationDeliverableType,
  PresentationTemplateId,
  PresentationPalette,
  PresentationFont,
  PresentationWidgetType,
  PresentationSlot,
  PresentationFormatGhost,
  PresentationFormatRequest,
} from "@workstream/contracts";
import {
  createPresentationDocumentClient,
  deletePresentationDocumentClient,
  dissectPlanClient,
  formatPageClient,
  listPresentationDocumentsClient,
  updatePresentationDocumentClient,
} from "./presentClient";
import { ConfirmDialog } from "@/components/ui";
import {
  KitButton,
  KitInput,
  KitTextarea,
  KitTabs,
  KitSeparator,
} from "@/components/ui/kit";
import css from "./present.module.css";
import { DeckInspectorDock } from "./DeckInspectorDock";
import { CameraChrome } from "../../CameraChrome";
import type { SketchStroke } from "../../studioCatalog";

/**
 * Lightweight serializable snapshot of the plan for rendering plan crops.
 * Drawn from the studio's live state (boundary, building, items, strokes) —
 * the same data the design canvas shows, but stripped to what a crop needs.
 * Board % coordinates, matching the %-coordinate model used by ImageLayer.
 */
export type PlanSnapshot = {
  boundary: { x: number; y: number }[];
  building: { x: number; y: number }[];
  items: {
    id: string;
    t: string;
    x: number;
    y: number;
    outlinePct?: { x: number; y: number }[];
  }[];
  strokes: SketchStroke[];
  northBearing?: number;
  /** Epoch-ms revision of the canvas — matches PlanCropRef.canvas_revision. */
  revision: number;
};

/**
 * Live estimate data for widget binding (Phase 4). Passed from
 * HandoffDesignStudio — the same StudioEstimateReport the quote HUD uses,
 * stripped to what the presentation widgets need.
 */
export type EstimateSnapshot = {
  totalInclGst: number;
  materialsExGst: number;
  gst: number;
  lines: { id: string; label: string; unit: string; qty: number; total: number }[];
  hardscapeM2: number;
  excavateM3: number;
};

/**
 * Material swatch from the live board — reused from the fit-sheet's
 * `materialChips` pattern. Each chip is `{ id, hex, label }` where `id` is
 * the StudioItemType (paving, deck, lawn, etc.) and `hex` is the palette
 * colour for that material.
 */
export type MaterialSwatch = {
  id: string;
  hex: string;
  label: string;
};

type Props = {
  projectId: string;
  /** Image layers from the design canvas — reused as image panels. */
  imageLayers: ImageLayer[];
  /** Plan snapshot for rendering plan-crop panels. */
  planSnapshot: PlanSnapshot | null;
  /** Live estimate data for widget binding (Phase 4). */
  estimate: EstimateSnapshot | null;
  /** Material swatches from the live board — for swatch_board panels. */
  materials: MaterialSwatch[];
  onBack: () => void;
  /**
   * Lifted save status — the UnifiedSaveStatus in the Tier-1 Top Bar reads
   * this so only one save indicator shows at a time (audit 2.3 / spec §4).
   * Called whenever the deck autosave state changes.
   */
  onSaveStatusChange?: (
    status: "idle" | "saving" | "saved" | "error",
    savedTick?: number,
    revision?: number,
  ) => void;
};

const DELIVERABLE_LABELS: Record<PresentationDeliverableType, string> = {
  deck: "Client deck",
  quotation: "Quotation",
  mood_board: "Mood board",
  concept_sketch: "Concept sketch",
};

const TEMPLATE_LABELS: Record<PresentationTemplateId, string> = {
  editorial_classic: "Editorial classic",
  editorial_minimal: "Editorial minimal",
  editorial_feature: "Editorial feature",
  editorial_schedule: "Editorial schedule",
};

const PALETTE_LABELS: Record<PresentationPalette, string> = {
  stone: "Stone",
  sage: "Sage",
  ink: "Ink",
  blush: "Blush",
  parchment: "Parchment",
};

const FONT_LABELS: Record<PresentationFont, string> = {
  fraunces: "Fraunces",
  sora: "Sora",
  inter: "Inter",
  handwritten: "Hand-written",
};

const WIDGET_LABELS: Record<PresentationWidgetType, string> = {
  quote_total: "Quote total",
  savings_ledger: "Savings ledger",
  zone_summary: "Zone summary",
  material_swatches: "Material swatches",
  caption: "Caption",
  honesty_footer: "Honesty footer",
  ops_schedule: "Ops schedule",
};

const WIDGET_SLOTS: Record<PresentationWidgetType, PresentationSlot> = {
  quote_total: "title_meta",
  savings_ledger: "side_stack",
  zone_summary: "side_stack",
  material_swatches: "footer_band",
  caption: "footer_band",
  honesty_footer: "footer_band",
  ops_schedule: "side_stack",
};

function newPanel(
  kind: PresentationPanel["kind"],
  opts?: {
    layer?: ImageLayer;
    widgetType?: PresentationWidgetType;
  },
): PresentationPanel {
  const id = crypto.randomUUID();
  const base = {
    id,
    rect: { x_pct: 10, y_pct: 10, w_pct: 40, h_pct: 30 },
    z_index: Date.now() % 1000,
  };
  if (kind === "text") {
    return {
      ...base,
      kind: "text",
      heading: "",
      body: "",
      role: "body",
    };
  }
  if (kind === "swatch_board") {
    return {
      ...base,
      kind: "swatch_board",
      swatch_ids: [],
      columns: 3,
      caption: "",
    };
  }
  if (kind === "image" && opts?.layer) {
    return {
      ...base,
      kind: "image",
      layer: opts.layer,
    };
  }
  if (kind === "widget" && opts?.widgetType) {
    return {
      ...base,
      kind: "widget",
      widget: {
        id: crypto.randomUUID(),
        type: opts.widgetType,
        slot: WIDGET_SLOTS[opts.widgetType],
        order: 0,
        style: { accent: "ink", emphasis: "standard" },
      },
    };
  }
  if (kind === "plan_crop") {
    return {
      ...base,
      kind: "plan_crop",
      ref: {
        canvas_revision: 0,
        crop: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
        reason: "overview",
        label: "",
        synced: true,
      },
    };
  }
  // Fallback
  return {
    ...base,
    kind: "text",
    heading: "",
    body: "",
    role: "body",
  };
}

export function PresentSurface({ projectId, imageLayers, planSnapshot, estimate, materials, onBack, onSaveStatusChange }: Props) {
  const [documents, setDocuments] = useState<PresentationDocument[]>([]);
  const [activeDoc, setActiveDoc] = useState<PresentationDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [pending, startTransition] = useTransition();
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [deckSettingsOpen, setDeckSettingsOpen] = useState(false);
  const [swatchPickerPanelId, setSwatchPickerPanelId] = useState<string | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deckRevisionRef = useRef(0);

  // Lift save status to parent for UnifiedSaveStatus (audit 2.3 / spec §4)
  useEffect(() => {
    if (!onSaveStatusChange) return;
    if (saveStatus === "saved") {
      deckRevisionRef.current += 1;
      onSaveStatusChange("saved", Date.now(), deckRevisionRef.current);
    } else if (saveStatus === "saving") {
      onSaveStatusChange("saving");
    } else if (saveStatus === "error") {
      onSaveStatusChange("error");
    }
  }, [saveStatus, onSaveStatusChange]);

  // --- Plan dissection ghost review state (Phase 2) ---
  const [ghosts, setGhosts] = useState<PresentationDissectGhost[]>([]);
  const [ghostRevision, setGhostRevision] = useState(0);
  const [dissecting, setDissecting] = useState(false);
  const [ghostReviewOpen, setGhostReviewOpen] = useState(false);

  // --- Editorial formatting ghost review state (Phase 3) ---
  const [formatGhosts, setFormatGhosts] = useState<PresentationFormatGhost[]>(
    [],
  );
  const [formatRationale, setFormatRationale] = useState("");
  const [formatting, setFormatting] = useState(false);
  const [formatReviewOpen, setFormatReviewOpen] = useState(false);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await listPresentationDocumentsClient(projectId);
      setDocuments(docs);
      if (docs.length > 0 && !activeDoc) setActiveDoc(docs[0]!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load decks");
    } finally {
      setLoading(false);
    }
  }, [projectId, activeDoc]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  // Debounced autosave when activeDoc changes (issued decks are frozen)
  useEffect(() => {
    if (!activeDoc) return;
    if (activeDoc.status === "issued") return;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const updated = await updatePresentationDocumentClient(
          projectId,
          activeDoc.id,
          {
            title: activeDoc.title,
            deliverable_type: activeDoc.deliverable_type,
            template_id: activeDoc.template_id,
            theme: activeDoc.theme,
            status: activeDoc.status,
            pages: activeDoc.pages,
          },
        );
        setActiveDoc(updated);
        setSaveStatus("saved");
      } catch (err) {
        setSaveStatus("error");
        setError(err instanceof Error ? err.message : "Save failed");
      }
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [projectId, activeDoc]);

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const input: CreatePresentationDocumentInput = {
          title: "Untitled deck",
          deliverable_type: "deck",
          template_id: "editorial_classic",
        };
        const doc = await createPresentationDocumentClient(projectId, input);
        setDocuments((prev) => [doc, ...prev]);
        setActiveDoc(doc);
        setActivePageIndex(0);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create deck");
      }
    });
  };

  const handleDelete = (docId: string) => {
    setConfirmDelete(docId);
  };

  const confirmDeleteDoc = () => {
    if (!confirmDelete) return;
    const docId = confirmDelete;
    setConfirmDelete(null);
    startTransition(async () => {
      try {
        await deletePresentationDocumentClient(projectId, docId);
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        if (activeDoc?.id === docId) setActiveDoc(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  };

  const updateDoc = (patch: Partial<PresentationDocument>) => {
    setActiveDoc((prev) => {
      if (!prev || prev.status === "issued") return prev;
      return { ...prev, ...patch, updated_at: new Date().toISOString() };
    });
  };

  const updatePage = (pageId: string, patch: Partial<PresentationPage>) => {
    if (!activeDoc || activeDoc.status === "issued") return;
    updateDoc({
      pages: activeDoc.pages.map((p) =>
        p.id === pageId ? { ...p, ...patch } : p,
      ),
    });
  };

  const addPage = () => {
    if (!activeDoc || activeDoc.status === "issued") return;
    const page: PresentationPage = {
      id: crypto.randomUUID(),
      order: activeDoc.pages.length,
      paper_size: "a3",
      orientation: "landscape",
      title_block: {
        title: "",
        subtitle: "",
        practice: "",
        revision: "",
        date_label: "",
        scale_label: "",
      },
      margins: { top_mm: 15, right_mm: 15, bottom_mm: 15, left_mm: 15 },
      panels: [],
    };
    updateDoc({ pages: [...activeDoc.pages, page] });
    setActivePageIndex(activeDoc.pages.length);
  };

  const addPanel = (
    pageId: string,
    kind: PresentationPanel["kind"],
    opts?: { layer?: ImageLayer; widgetType?: PresentationWidgetType },
  ) => {
    if (!activeDoc || activeDoc.status === "issued") return;
    const panel = newPanel(kind, opts);
    const page = activeDoc.pages[activePageIndex];
    if (!page) return;
    // Stagger new panels so they don't overlap exactly
    const offset = page.panels.length * 5;
    panel.rect = {
      x_pct: Math.min(10 + offset, 50),
      y_pct: Math.min(10 + offset, 50),
      w_pct: 40,
      h_pct: 30,
    };
    updatePage(pageId, {
      panels: [...page.panels, panel],
    });
  };

  const updatePanel = (
    pageId: string,
    panelId: string,
    patch: Partial<PresentationPanel>,
  ) => {
    if (!activeDoc) return;
    const page = activeDoc.pages.find((p) => p.id === pageId);
    if (!page) return;
    updatePage(pageId, {
      panels: page.panels.map((p) =>
        p.id === panelId ? ({ ...p, ...patch } as PresentationPanel) : p,
      ),
    });
  };

  const removePanel = (pageId: string, panelId: string) => {
    if (!activeDoc) return;
    const page = activeDoc.pages.find((p) => p.id === pageId);
    if (!page) return;
    updatePage(pageId, {
      panels: page.panels.filter((p) => p.id !== panelId),
    });
  };

  const bringToFront = (pageId: string, panelId: string) => {
    if (!activeDoc) return;
    const page = activeDoc.pages.find((p) => p.id === pageId);
    if (!page) return;
    const maxZ = page.panels.reduce((m, p) => Math.max(m, p.z_index), 0);
    updatePanel(pageId, panelId, { z_index: maxZ + 1 });
  };

  // --- Plan dissection (Phase 2) ---

  const handleDissect = () => {
    if (!activeDoc || activeDoc.status === "issued") return;
    setDissecting(true);
    setError(null);
    startTransition(async () => {
      try {
        const result = await dissectPlanClient(projectId);
        setGhosts(result.ghosts);
        setGhostRevision(result.canvas_revision);
        setGhostReviewOpen(result.ghosts.length > 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Dissection failed");
      } finally {
        setDissecting(false);
      }
    });
  };

  const acceptGhost = (index: number) => {
    const ghost = ghosts[index];
    if (!ghost || !activeDoc || activeDoc.status === "issued") return;
    const page = activeDoc.pages[activePageIndex];
    if (!page) return;
    const panel: PresentationPanel = {
      id: crypto.randomUUID(),
      kind: "plan_crop",
      rect: { x_pct: 10, y_pct: 10, w_pct: 40, h_pct: 30 },
      z_index: Date.now() % 1000,
      ref: {
        canvas_revision: ghostRevision,
        crop: ghost.crop,
        reason: ghost.reason,
        label: ghost.label,
        synced: true,
      },
    };
    updatePage(page.id, { panels: [...page.panels, panel] });
    setGhosts((prev) => prev.filter((_, i) => i !== index));
    if (ghosts.length <= 1) setGhostReviewOpen(false);
  };

  const acceptAllGhosts = () => {
    if (!activeDoc || ghosts.length === 0) return;
    const page = activeDoc.pages[activePageIndex];
    if (!page) return;
    const newPanels: PresentationPanel[] = ghosts.map((ghost, i) => ({
      id: crypto.randomUUID(),
      kind: "plan_crop",
      rect: {
        x_pct: Math.min(10 + i * 5, 50),
        y_pct: Math.min(10 + i * 5, 50),
        w_pct: 40,
        h_pct: 30,
      },
      z_index: (Date.now() + i) % 1000,
      ref: {
        canvas_revision: ghostRevision,
        crop: ghost.crop,
        reason: ghost.reason,
        label: ghost.label,
        synced: true,
      },
    }));
    updatePage(page.id, { panels: [...page.panels, ...newPanels] });
    setGhosts([]);
    setGhostReviewOpen(false);
  };

  const rejectGhost = (index: number) => {
    setGhosts((prev) => prev.filter((_, i) => i !== index));
    if (ghosts.length <= 1) setGhostReviewOpen(false);
  };

  // --- Sync plan crop to latest revision (Phase 2 stretch) ---

  const syncPlanCrop = (pageId: string, panelId: string) => {
    if (!planSnapshot || !activeDoc) return;
    const page = activeDoc.pages.find((p) => p.id === pageId);
    if (!page) return;
    const panel = page.panels.find((p) => p.id === panelId);
    if (!panel || panel.kind !== "plan_crop") return;
    updatePanel(pageId, panelId, {
      ref: {
        ...panel.ref,
        canvas_revision: planSnapshot.revision,
        synced: true,
      },
    } as Partial<PresentationPanel>);
  };

  // --- Swatch board catalog wiring (polish) ---

  const toggleSwatch = (pageId: string, panelId: string, swatchId: string) => {
    if (!activeDoc) return;
    const page = activeDoc.pages.find((p) => p.id === pageId);
    if (!page) return;
    const panel = page.panels.find((p) => p.id === panelId);
    if (!panel || panel.kind !== "swatch_board") return;
    const ids = panel.swatch_ids.includes(swatchId)
      ? panel.swatch_ids.filter((id) => id !== swatchId)
      : [...panel.swatch_ids, swatchId];
    updatePanel(pageId, panelId, {
      swatch_ids: ids,
    } as Partial<PresentationPanel>);
  };

  // --- AI editorial formatting (Phase 3) ---

  const handleFormat = () => {
    if (!activeDoc || activeDoc.status === "issued") return;
    const page = activeDoc.pages[activePageIndex];
    if (!page || page.panels.length === 0) return;
    setFormatting(true);
    setError(null);
    startTransition(async () => {
      try {
        const req: PresentationFormatRequest = {
          deliverable_type: activeDoc.deliverable_type,
          template_id: activeDoc.template_id,
          panels: page.panels.map((p) => {
            const base: PresentationFormatRequest["panels"][number] = {
              id: p.id,
              kind: p.kind,
            };
            if (p.kind === "plan_crop") base.reason = p.ref.reason;
            if (p.kind === "widget") base.widget_type = p.widget.type;
            if (p.kind === "text") base.role = p.role;
            return base;
          }),
        };
        const result = await formatPageClient(projectId, req);
        setFormatGhosts(result.ghosts);
        setFormatRationale(result.rationale);
        setFormatReviewOpen(result.ghosts.length > 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Formatting failed");
      } finally {
        setFormatting(false);
      }
    });
  };

  const acceptFormatGhost = (panelId: string) => {
    if (!activeDoc) return;
    const page = activeDoc.pages[activePageIndex];
    if (!page) return;
    const ghost = formatGhosts.find((g) => g.id === panelId);
    if (!ghost) return;
    updatePanel(page.id, panelId, { rect: ghost.rect });
    setFormatGhosts((prev) => prev.filter((g) => g.id !== panelId));
    if (formatGhosts.length <= 1) setFormatReviewOpen(false);
  };

  const acceptAllFormatGhosts = () => {
    if (!activeDoc || formatGhosts.length === 0) return;
    const page = activeDoc.pages[activePageIndex];
    if (!page) return;
    const rectMap = new Map(formatGhosts.map((g) => [g.id, g.rect]));
    updatePage(page.id, {
      panels: page.panels.map((p) => {
        const rect = rectMap.get(p.id);
        return rect ? ({ ...p, rect } as PresentationPanel) : p;
      }),
    });
    setFormatGhosts([]);
    setFormatReviewOpen(false);
  };

  const rejectFormatGhost = (panelId: string) => {
    setFormatGhosts((prev) => prev.filter((g) => g.id !== panelId));
    if (formatGhosts.length <= 1) setFormatReviewOpen(false);
  };

  // --- Apply template — same Format ghosts; never silent-write ---

  const handleApplyTemplate = () => {
    handleFormat();
  };

  const handleIssue = () => {
    if (!activeDoc || activeDoc.status === "issued") return;
    setConfirmIssue(true);
  };

  const confirmIssueDoc = () => {
    if (!activeDoc || activeDoc.status === "issued") return;
    setConfirmIssue(false);
    startTransition(async () => {
      try {
        const snapshot = estimate
          ? {
            totalInclGst: estimate.totalInclGst,
            materialsExGst: estimate.materialsExGst,
            gst: estimate.gst,
            hardscapeM2: estimate.hardscapeM2,
            excavateM3: estimate.excavateM3,
            lines: estimate.lines,
            captured_at: new Date().toISOString(),
          }
          : null;
        const updated = await updatePresentationDocumentClient(
          projectId,
          activeDoc.id,
          {
            status: "issued",
            estimate_snapshot: snapshot,
            title: activeDoc.title,
            deliverable_type: activeDoc.deliverable_type,
            template_id: activeDoc.template_id,
            theme: activeDoc.theme,
            pages: activeDoc.pages,
          },
        );
        setActiveDoc(updated);
        setDocuments((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d)),
        );
        setDeckSettingsOpen(false);
        setGhostReviewOpen(false);
        setFormatReviewOpen(false);
        setGhosts([]);
        setFormatGhosts([]);
        setSaveStatus("saved");
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not issue deck");
      }
    });
  };

  const currentPage =
    activeDoc?.pages[activePageIndex] ??
    activeDoc?.pages[activeDoc.pages.length - 1] ??
    null;

  const surfaceState =
    ghostReviewOpen || formatReviewOpen
      ? "ghost"
      : !activeDoc
        ? "empty"
        : activeDoc.status === "issued"
          ? "locked"
          : "ready";

  const surfaceCopy =
    surfaceState === "ghost"
      ? "Ghost review — accept or reject proposals before issuing"
      : surfaceState === "empty"
        ? "Empty — create a deck to start composing"
        : surfaceState === "locked"
          ? "Locked — this deck is issued; edits are blocked"
          : "Ready — compose pages and panels";

  const isLocked = activeDoc?.status === "issued";
  const draftingSuspended =
    isLocked || ghostReviewOpen || formatReviewOpen;
  const deckSummary = activeDoc
    ? [
        { label: "Pages", value: String(activeDoc.pages.length) },
        {
          label: "Panels",
          value: String(activeDoc.pages.reduce((sum, page) => sum + page.panels.length, 0)),
        },
        { label: "Template", value: TEMPLATE_LABELS[activeDoc.template_id] },
        {
          label: "Theme",
          value: `${PALETTE_LABELS[activeDoc.theme.palette]} · ${FONT_LABELS[activeDoc.theme.font]}`,
        },
      ]
    : [];
  const widgetEstimate =
    isLocked && activeDoc?.estimate_snapshot
      ? {
        totalInclGst: activeDoc.estimate_snapshot.totalInclGst,
        materialsExGst: activeDoc.estimate_snapshot.materialsExGst,
        gst: activeDoc.estimate_snapshot.gst,
        lines: activeDoc.estimate_snapshot.lines,
        hardscapeM2: activeDoc.estimate_snapshot.hardscapeM2,
        excavateM3: activeDoc.estimate_snapshot.excavateM3,
      }
      : isLocked
        ? null
        : estimate;

  return (
    <div
      className={css.root}
      data-testid="present-surface"
      data-surface-state={surfaceState}
    >
      <div className={css.sidebar}>
        <div className={css.sidebarHeader}>
          <KitButton variant="ghost" size="sm" onClick={onBack} aria-label="Back to CAD">
            Back
          </KitButton>
          <h2 className={css.sidebarTitle}>Present</h2>
        </div>
        <p
          className={css.surfaceBanner}
          data-testid="present-surface-banner"
          data-state={surfaceState}
        >
          {surfaceCopy}
        </p>

        <div className={css.sidebarStats} aria-label="Deck summary">
          {deckSummary.map((item) => (
            <div key={item.label} className={css.statCard}>
              <span className={css.statLabel}>{item.label}</span>
              <span className={css.statValue}>{item.value}</span>
            </div>
          ))}
        </div>

        <KitButton
          variant="default"
          size="md"
          onClick={handleCreate}
          disabled={pending}
          fullWidth
          className={css.createBtn}
        >
          New deck
        </KitButton>

        {error ? <p className={css.error}>{error}</p> : null}

        <ul className={css.docList}>
          {documents.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                className={`${css.docItem}${activeDoc?.id === doc.id ? ` ${css.docItemActive}` : ""}`}
                onClick={() => {
                  setActiveDoc(doc);
                  setActivePageIndex(0);
                }}
              >
                <span className={css.docTitle}>{doc.title}</span>
                <span className={css.docMeta}>
                  {DELIVERABLE_LABELS[doc.deliverable_type]}
                  {doc.status === "issued" ? " — issued" : ""}
                </span>
              </button>
              <KitButton
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(doc.id)}
                aria-label={`Delete ${doc.title}`}
                className={css.docDelete}
              >
                Delete
              </KitButton>
            </li>
          ))}
          {loading && documents.length === 0 ? (
            <li className={css.empty}>Loading...</li>
          ) : null}
          {!loading && documents.length === 0 ? (
            <li className={css.empty}>No decks yet. Create one to start.</li>
          ) : null}
        </ul>
      </div>

      {activeDoc ? (
        <div className={css.workspace}>
          <div className={css.toolbar}>
            <span className={css.toolbarTitle} data-testid="present-deck-title">
              {activeDoc.title || "Untitled deck"}
            </span>
            <KitButton
              variant="secondary"
              size="sm"
              onClick={() => setDeckSettingsOpen((v) => !v)}
              aria-expanded={deckSettingsOpen}
              aria-label="Deck settings"
              data-testid="deck-settings-toggle"
              disabled={isLocked}
            >
              Deck settings
            </KitButton>
            <KitButton
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              data-testid="print-deck-btn"
            >
              Print
            </KitButton>
            {isLocked ? (
              <span className={css.issuedBadge} data-testid="present-issued-badge">
                Issued
              </span>
            ) : (
              <KitButton
                variant="accent"
                size="sm"
                onClick={handleIssue}
                disabled={pending}
                data-testid="issue-deck-btn"
              >
                Issue
              </KitButton>
            )}
          </div>
          {deckSettingsOpen && !isLocked ? (
            <CameraChrome
              place={{ kind: "dock" }}
              zIndex={40}
              testId="present-deck-settings-chrome"
            >
              <DeckInspectorDock
                open={deckSettingsOpen}
                onClose={() => setDeckSettingsOpen(false)}
                title={activeDoc.title}
                onTitleChange={(title) => updateDoc({ title })}
                deliverableType={activeDoc.deliverable_type}
                onDeliverableTypeChange={(value) =>
                  updateDoc({
                    deliverable_type: value as PresentationDeliverableType,
                  })
                }
                templateId={activeDoc.template_id}
                onTemplateIdChange={(value) =>
                  updateDoc({
                    template_id: value as PresentationTemplateId,
                  })
                }
                palette={activeDoc.theme.palette}
                onPaletteChange={(value) =>
                  updateDoc({
                    theme: {
                      ...activeDoc.theme,
                      palette: value as PresentationPalette,
                    },
                  })
                }
                font={activeDoc.theme.font}
                onFontChange={(value) =>
                  updateDoc({
                    theme: {
                      ...activeDoc.theme,
                      font: value as PresentationFont,
                    },
                  })
                }
                deliverableOptions={Object.entries(DELIVERABLE_LABELS)}
                templateOptions={Object.entries(TEMPLATE_LABELS)}
                paletteOptions={Object.entries(PALETTE_LABELS)}
                fontOptions={Object.entries(FONT_LABELS)}
              />
            </CameraChrome>
          ) : null}

          <div className={css.pageArea}>
            {currentPage ? (
              <PageCanvas
                key={currentPage.id}
                page={currentPage}
                palette={activeDoc.theme.palette}
                font={activeDoc.theme.font}
                locked={draftingSuspended}
                imageLayers={imageLayers}
                planSnapshot={planSnapshot}
                estimate={widgetEstimate}
                materials={materials}
                onAddPanel={(kind, opts) =>
                  addPanel(currentPage.id, kind, opts)
                }
                onUpdatePanel={(id, patch) =>
                  updatePanel(currentPage.id, id, patch)
                }
                onRemovePanel={(id) => removePanel(currentPage.id, id)}
                onBringToFront={(id) => bringToFront(currentPage.id, id)}
                onSyncPlanCrop={(panelId) =>
                  syncPlanCrop(currentPage.id, panelId)
                }
                onToggleSwatch={(panelId, swatchId) =>
                  toggleSwatch(currentPage.id, panelId, swatchId)
                }
                swatchPickerPanelId={swatchPickerPanelId}
                setSwatchPickerPanelId={setSwatchPickerPanelId}
                imagePickerOpen={imagePickerOpen}
                setImagePickerOpen={setImagePickerOpen}
                widgetPickerOpen={widgetPickerOpen}
                setWidgetPickerOpen={setWidgetPickerOpen}
                onDissect={handleDissect}
                dissecting={dissecting}
                ghostReviewOpen={ghostReviewOpen}
                ghosts={ghosts}
                onAcceptGhost={acceptGhost}
                onAcceptAllGhosts={acceptAllGhosts}
                onRejectGhost={rejectGhost}
                onRejectAllGhosts={() => {
                  setGhosts([]);
                  setGhostReviewOpen(false);
                }}
                onFormat={handleFormat}
                onApplyTemplate={handleApplyTemplate}
                formatting={formatting}
                formatReviewOpen={formatReviewOpen}
                formatGhosts={formatGhosts}
                formatRationale={formatRationale}
                onAcceptFormatGhost={acceptFormatGhost}
                onAcceptAllFormatGhosts={acceptAllFormatGhosts}
                onRejectFormatGhost={rejectFormatGhost}
                onRejectAllFormatGhosts={() => {
                  setFormatGhosts([]);
                  setFormatReviewOpen(false);
                }}
              />
            ) : (
              <div className={css.noPage}>
                <p>No pages. Add one to start composing.</p>
                <KitButton
                  variant="default"
                  size="md"
                  onClick={addPage}
                  disabled={isLocked}
                >
                  Add page
                </KitButton>
              </div>
            )}
          </div>

          <div className={css.pageNav}>
            <KitTabs
              tabs={activeDoc.pages.map((p, i) => ({
                value: String(i),
                label: String(i + 1),
              }))}
              value={String(activePageIndex)}
              onChange={(v) => setActivePageIndex(Number(v))}
              className={css.pageTabs}
            />
            <span className={css.pageCount}>
              {activeDoc.pages.length} page{activeDoc.pages.length === 1 ? "" : "s"}
            </span>
            <KitButton
              variant="secondary"
              size="sm"
              onClick={addPage}
              disabled={isLocked}
            >
              Add page
            </KitButton>
          </div>
        </div>
      ) : (
        <div className={css.emptyWorkspace} data-testid="present-empty-workspace">
          <p className={css.emptyLead}>
            Select a deck or create one to start composing.
          </p>
          <KitButton
            variant="default"
            size="lg"
            onClick={handleCreate}
            disabled={pending}
          >
            New deck
          </KitButton>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete != null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteDoc}
        title="Delete deck?"
        destructive
        confirmLabel="Delete"
        confirmTestId="delete-deck-confirm"
      >
        {confirmDelete ? (
          <p>
            <strong>
              {documents.find((d) => d.id === confirmDelete)?.title ??
                "This deck"}
            </strong>
            <br />
            <br />
            This cannot be undone.
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmIssue}
        onClose={() => setConfirmIssue(false)}
        onConfirm={confirmIssueDoc}
        title="Issue deck?"
        confirmLabel="Issue"
        confirmTestId="issue-deck-confirm"
      >
        <p>
          Edits will be blocked and live quote figures freeze as a snapshot.
        </p>
      </ConfirmDialog>
    </div>
  );
}

type PageCanvasProps = {
  page: PresentationPage;
  palette: PresentationPalette;
  font: PresentationFont;
  /** Issued freeze or open ghost review — drafting tools yield. */
  locked: boolean;
  imageLayers: ImageLayer[];
  planSnapshot: PlanSnapshot | null;
  estimate: EstimateSnapshot | null;
  materials: MaterialSwatch[];
  onAddPanel: (
    kind: PresentationPanel["kind"],
    opts?: { layer?: ImageLayer; widgetType?: PresentationWidgetType },
  ) => void;
  onUpdatePanel: (id: string, patch: Partial<PresentationPanel>) => void;
  onRemovePanel: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSyncPlanCrop: (panelId: string) => void;
  onToggleSwatch: (panelId: string, swatchId: string) => void;
  swatchPickerPanelId: string | null;
  setSwatchPickerPanelId: (id: string | null) => void;
  imagePickerOpen: boolean;
  setImagePickerOpen: (open: boolean) => void;
  widgetPickerOpen: boolean;
  setWidgetPickerOpen: (open: boolean) => void;
  onDissect: () => void;
  dissecting: boolean;
  ghostReviewOpen: boolean;
  ghosts: PresentationDissectGhost[];
  onAcceptGhost: (index: number) => void;
  onAcceptAllGhosts: () => void;
  onRejectGhost: (index: number) => void;
  onRejectAllGhosts: () => void;
  onFormat: () => void;
  onApplyTemplate: () => void;
  formatting: boolean;
  formatReviewOpen: boolean;
  formatGhosts: PresentationFormatGhost[];
  formatRationale: string;
  onAcceptFormatGhost: (panelId: string) => void;
  onAcceptAllFormatGhosts: () => void;
  onRejectFormatGhost: (panelId: string) => void;
  onRejectAllFormatGhosts: () => void;
};

function PageCanvas({
  page,
  palette,
  font,
  locked,
  imageLayers,
  planSnapshot,
  estimate,
  materials,
  onAddPanel,
  onUpdatePanel,
  onRemovePanel,
  onBringToFront,
  onSyncPlanCrop,
  onToggleSwatch,
  swatchPickerPanelId,
  setSwatchPickerPanelId,
  imagePickerOpen,
  setImagePickerOpen,
  widgetPickerOpen,
  setWidgetPickerOpen,
  onDissect,
  dissecting,
  ghostReviewOpen,
  ghosts,
  onAcceptGhost,
  onAcceptAllGhosts,
  onRejectGhost,
  onRejectAllGhosts,
  onFormat,
  onApplyTemplate,
  formatting,
  formatReviewOpen,
  formatGhosts,
  formatRationale,
  onAcceptFormatGhost,
  onAcceptAllFormatGhosts,
  onRejectFormatGhost,
  onRejectAllFormatGhosts,
}: PageCanvasProps) {
  return (
    <div
      className={css.pageCanvas}
      data-testid="present-page-canvas"
      data-drafting-suspended={locked ? "1" : "0"}
    >
      <div
        className={css.pagePaper}
        data-testid="present-page-paper"
        data-palette={palette}
        data-font={font}
      >
        {page.panels
          .slice()
          .sort((a, b) => a.z_index - b.z_index)
          .map((panel) => (
            <PanelView
              key={panel.id}
              panel={panel}
              locked={locked}
              planSnapshot={planSnapshot}
              estimate={estimate}
              materials={materials}
              formatGhost={formatGhosts.find((g) => g.id === panel.id)}
              onUpdate={(patch) => onUpdatePanel(panel.id, patch)}
              onRemove={() => onRemovePanel(panel.id)}
              onBringToFront={() => onBringToFront(panel.id)}
              onSyncPlanCrop={() => onSyncPlanCrop(panel.id)}
              onToggleSwatch={(swatchId) => onToggleSwatch(panel.id, swatchId)}
              swatchPickerOpen={swatchPickerPanelId === panel.id}
              onOpenSwatchPicker={() => setSwatchPickerPanelId(panel.id)}
              onCloseSwatchPicker={() => setSwatchPickerPanelId(null)}
            />
          ))}
        {page.panels.length === 0 ? (
          <div className={css.pageEmpty}>
            <p>Empty page. Add a panel below to start.</p>
          </div>
        ) : null}
        {formatReviewOpen && formatGhosts.length > 0 ? (
          <FormatGhostOverlay
            ghosts={formatGhosts}
            onAccept={onAcceptFormatGhost}
            onReject={onRejectFormatGhost}
          />
        ) : null}
      </div>
      <div className={css.panelAddBar} aria-disabled={locked || undefined}>
        <KitButton
          variant="secondary"
          size="sm"
          onClick={() => onAddPanel("text")}
          disabled={locked}
        >
          Add text
        </KitButton>
        <KitButton
          variant="secondary"
          size="sm"
          onClick={() => onAddPanel("plan_crop")}
          disabled={locked}
          data-testid="add-plan-crop-btn"
        >
          Add plan crop
        </KitButton>
        <KitButton
          variant="secondary"
          size="sm"
          onClick={() => onAddPanel("swatch_board")}
          disabled={locked}
        >
          Add swatch board
        </KitButton>
        <KitButton
          variant="secondary"
          size="sm"
          onClick={() => setImagePickerOpen(!imagePickerOpen)}
          aria-expanded={imagePickerOpen}
          disabled={locked}
        >
          Add image
        </KitButton>
        <KitButton
          variant="secondary"
          size="sm"
          onClick={() => setWidgetPickerOpen(!widgetPickerOpen)}
          aria-expanded={widgetPickerOpen}
          disabled={locked}
        >
          Add widget
        </KitButton>
        <KitSeparator orientation="vertical" className={css.addBarSep} />
        <KitButton
          variant="accent"
          size="sm"
          onClick={onDissect}
          disabled={locked || dissecting}
          loading={dissecting}
          data-testid="dissect-plan-btn"
        >
          {dissecting ? "Dissecting" : "Dissect plan"}
        </KitButton>
        <KitButton
          variant="outline"
          size="sm"
          onClick={onFormat}
          disabled={locked || formatting || page.panels.length === 0}
          loading={formatting}
          data-testid="format-page-btn"
        >
          {formatting ? "Formatting" : "Format page"}
        </KitButton>
        <KitButton
          variant="destructive"
          size="sm"
          onClick={onApplyTemplate}
          disabled={locked || formatting || page.panels.length === 0}
          data-testid="apply-template-btn"
        >
          Apply template
        </KitButton>
      </div>

      {imagePickerOpen && !locked ? (
        <ImagePicker
          layers={imageLayers}
          onPick={(layer) => {
            onAddPanel("image", { layer });
            setImagePickerOpen(false);
          }}
          onClose={() => setImagePickerOpen(false)}
        />
      ) : null}

      {widgetPickerOpen && !locked ? (
        <WidgetPicker
          onPick={(widgetType) => {
            onAddPanel("widget", { widgetType });
            setWidgetPickerOpen(false);
          }}
          onClose={() => setWidgetPickerOpen(false)}
        />
      ) : null}

      {ghostReviewOpen ? (
        <GhostReview
          ghosts={ghosts}
          onAccept={onAcceptGhost}
          onAcceptAll={onAcceptAllGhosts}
          onReject={onRejectGhost}
          onClose={onRejectAllGhosts}
        />
      ) : null}

      {formatReviewOpen ? (
        <FormatReview
          ghosts={formatGhosts}
          rationale={formatRationale}
          onAccept={onAcceptFormatGhost}
          onAcceptAll={onAcceptAllFormatGhosts}
          onReject={onRejectFormatGhost}
          onClose={onRejectAllFormatGhosts}
        />
      ) : null}
    </div>
  );
}

// --- Image picker ---

function ImagePicker({
  layers,
  onPick,
  onClose,
}: {
  layers: ImageLayer[];
  onPick: (layer: ImageLayer) => void;
  onClose: () => void;
}) {
  if (layers.length === 0) {
    return (
      <div className={css.picker} data-testid="image-picker">
        <div className={css.pickerHeader}>
          <span className={css.pickerTitle}>Pick an image layer</span>
          <KitButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            Close
          </KitButton>
        </div>
        <p className={css.pickerEmpty}>
          No image layers on the canvas. Import a photo or plan underlay in
          Sketch or CAD mode first.
        </p>
      </div>
    );
  }
  return (
    <div className={css.picker} data-testid="image-picker">
      <div className={css.pickerHeader}>
        <span className={css.pickerTitle}>Pick an image layer</span>
        <KitButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          Close
        </KitButton>
      </div>
      <ul className={css.pickerList}>
        {layers.map((layer) => (
          <li key={layer.id}>
            <button
              type="button"
              className={css.pickerItem}
              onClick={() => onPick(layer)}
            >
              <img
                src={layer.uri}
                alt={layer.name}
                className={css.pickerThumb}
              />
              <span className={css.pickerLabel}>{layer.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Widget picker ---

function WidgetPicker({
  onPick,
  onClose,
}: {
  onPick: (widgetType: PresentationWidgetType) => void;
  onClose: () => void;
}) {
  return (
    <div className={css.picker} data-testid="widget-picker">
      <div className={css.pickerHeader}>
        <span className={css.pickerTitle}>Pick a widget</span>
        <KitButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          Close
        </KitButton>
      </div>
      <ul className={css.pickerList}>
        {(Object.keys(WIDGET_LABELS) as PresentationWidgetType[]).map((wt) => (
          <li key={wt}>
            <button
              type="button"
              className={css.pickerItem}
              onClick={() => onPick(wt)}
            >
              <span className={css.pickerLabel}>{WIDGET_LABELS[wt]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Panel view with drag + resize ---

type DragState = {
  mode: "move" | "resize-se" | "resize-sw" | "resize-ne" | "resize-nw";
  startX: number;
  startY: number;
  origRect: { x_pct: number; y_pct: number; w_pct: number; h_pct: number };
};

type PanelViewProps = {
  panel: PresentationPanel;
  locked?: boolean;
  planSnapshot: PlanSnapshot | null;
  estimate: EstimateSnapshot | null;
  materials: MaterialSwatch[];
  formatGhost?: PresentationFormatGhost;
  onUpdate: (patch: Partial<PresentationPanel>) => void;
  onRemove: () => void;
  onBringToFront: () => void;
  onSyncPlanCrop: () => void;
  onToggleSwatch: (swatchId: string) => void;
  swatchPickerOpen: boolean;
  onOpenSwatchPicker: () => void;
  onCloseSwatchPicker: () => void;
};

function PanelView({
  panel,
  locked = false,
  planSnapshot,
  estimate,
  materials,
  formatGhost,
  onUpdate,
  onRemove,
  onBringToFront,
  onSyncPlanCrop,
  onToggleSwatch,
  swatchPickerOpen,
  onOpenSwatchPicker,
  onCloseSwatchPicker,
}: PanelViewProps) {
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLElement>(null);

  // Get the paper element (parent of panel) for coordinate math
  useEffect(() => {
    if (panelRef.current) {
      paperRef.current = panelRef.current.parentElement;
    }
  }, []);

  useEffect(() => {
    if (locked) setEditing(false);
  }, [locked]);

  const onPointerDown = (
    e: React.PointerEvent,
    mode: DragState["mode"],
  ) => {
    if (locked) return;
    // Don't start drag when clicking inside edit fields
    if (editing && mode === "move") {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    }
    e.stopPropagation();
    e.preventDefault();
    onBringToFront();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origRect: { ...panel.rect },
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !paperRef.current) return;
    const paperRect = paperRef.current.getBoundingClientRect();
    const dxPct = ((e.clientX - drag.startX) / paperRect.width) * 100;
    const dyPct = ((e.clientY - drag.startY) / paperRect.height) * 100;
    const orig = drag.origRect;
    const newRect = { ...orig };

    if (drag.mode === "move") {
      newRect.x_pct = Math.max(0, Math.min(100 - orig.w_pct, orig.x_pct + dxPct));
      newRect.y_pct = Math.max(0, Math.min(100 - orig.h_pct, orig.y_pct + dyPct));
    } else if (drag.mode === "resize-se") {
      newRect.w_pct = Math.max(5, Math.min(100 - orig.x_pct, orig.w_pct + dxPct));
      newRect.h_pct = Math.max(5, Math.min(100 - orig.y_pct, orig.h_pct + dyPct));
    } else if (drag.mode === "resize-sw") {
      newRect.x_pct = Math.max(0, Math.min(orig.x_pct + orig.w_pct - 5, orig.x_pct + dxPct));
      newRect.w_pct = Math.max(5, orig.w_pct - dxPct);
      newRect.h_pct = Math.max(5, Math.min(100 - orig.y_pct, orig.h_pct + dyPct));
    } else if (drag.mode === "resize-ne") {
      newRect.y_pct = Math.max(0, Math.min(orig.y_pct + orig.h_pct - 5, orig.y_pct + dyPct));
      newRect.w_pct = Math.max(5, Math.min(100 - orig.x_pct, orig.w_pct + dxPct));
      newRect.h_pct = Math.max(5, orig.h_pct - dyPct);
    } else if (drag.mode === "resize-nw") {
      newRect.x_pct = Math.max(0, Math.min(orig.x_pct + orig.w_pct - 5, orig.x_pct + dxPct));
      newRect.y_pct = Math.max(0, Math.min(orig.y_pct + orig.h_pct - 5, orig.y_pct + dyPct));
      newRect.w_pct = Math.max(5, orig.w_pct - dxPct);
      newRect.h_pct = Math.max(5, orig.h_pct - dyPct);
    }

    onUpdate({ rect: newRect });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (drag) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      setDrag(null);
    }
  };

  const style = {
    left: `${panel.rect.x_pct}%`,
    top: `${panel.rect.y_pct}%`,
    width: `${panel.rect.w_pct}%`,
    height: `${panel.rect.h_pct}%`,
    zIndex: panel.z_index,
  };

  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent) => onPointerDown(e, "move"),
    onPointerMove,
    onPointerUp,
  };

  if (panel.kind === "text") {
    return (
      <div
        ref={panelRef}
        className={css.panel}
        style={style}
        data-testid="present-panel"
        data-panel-kind="text"
        {...dragHandlers}
      >
        {editing ? (
          <div className={css.panelEdit} onPointerDown={(e) => e.stopPropagation()}>
            <KitInput
              className={css.panelHeadingInput}
              value={panel.heading}
              onChange={(e) =>
                onUpdate({ heading: e.target.value } as Partial<PresentationPanel>)
              }
              placeholder="Heading"
            />
            <KitTextarea
              className={css.panelBodyInput}
              value={panel.body}
              onChange={(e) =>
                onUpdate({ body: e.target.value } as Partial<PresentationPanel>)
              }
              placeholder="Body text..."
              rows={4}
            />
            <KitButton
              variant="default"
              size="sm"
              onClick={() => setEditing(false)}
              className={css.panelDoneBtn}
            >
              Done
            </KitButton>
          </div>
        ) : (
          <button
            type="button"
            className={css.panelContent}
            onClick={() => {
              if (!locked) setEditing(true);
            }}
          >
            {panel.heading ? (
              <h3 className={css.panelHeading}>{panel.heading}</h3>
            ) : null}
            {panel.body ? (
              <p className={css.panelBody}>{panel.body}</p>
            ) : null}
            {!panel.heading && !panel.body ? (
              <p className={css.panelPlaceholder}>Click to edit</p>
            ) : null}
          </button>
        )}
        <ResizeHandles onPointerDown={onPointerDown} />
        <PanelActions onRemove={onRemove} />
      </div>
    );
  }

  if (panel.kind === "image") {
    return (
      <div
        ref={panelRef}
        className={css.panel}
        style={style}
        data-testid="present-panel"
        data-panel-kind="image"
        {...dragHandlers}
      >
        <div className={css.panelContent}>
          <img
            src={panel.layer.uri}
            alt={panel.layer.name}
            className={css.panelImage}
            draggable={false}
          />
        </div>
        <ResizeHandles onPointerDown={onPointerDown} />
        <PanelActions onRemove={onRemove} />
      </div>
    );
  }

  if (panel.kind === "widget") {
    return (
      <div
        ref={panelRef}
        className={css.panel}
        style={style}
        data-testid="present-panel"
        data-panel-kind="widget"
        data-format-pending={formatGhost ? "1" : undefined}
        {...dragHandlers}
      >
        <div className={css.panelContent}>
          <div className={css.widgetChrome} data-widget-type={panel.widget.type}>
            <span className={css.widgetType}>{WIDGET_LABELS[panel.widget.type]}</span>
            {panel.widget.text ? (
              <p className={css.widgetText}>{panel.widget.text}</p>
            ) : (
              <WidgetLiveContent type={panel.widget.type} estimate={estimate} />
            )}
          </div>
        </div>
        <ResizeHandles onPointerDown={onPointerDown} />
        <PanelActions onRemove={onRemove} />
      </div>
    );
  }

  if (panel.kind === "plan_crop") {
    const isStale =
      planSnapshot != null &&
      panel.ref.canvas_revision !== planSnapshot.revision;
    return (
      <div
        ref={panelRef}
        className={css.panel}
        style={style}
        data-testid="present-panel"
        data-panel-kind="plan_crop"
        data-stale={isStale ? "1" : undefined}
        data-format-pending={formatGhost ? "1" : undefined}
        {...dragHandlers}
      >
        <div className={css.panelContent}>
          {planSnapshot ? (
            <PlanCropSvg snapshot={planSnapshot} crop={panel.ref.crop} />
          ) : (
            <p className={css.panelPlaceholder}>No plan loaded</p>
          )}
          <span className={css.planCropLabel}>
            {panel.ref.label || "Plan crop"}
            {isStale ? " (stale)" : ""}
          </span>
          {isStale ? (
            <KitButton
              variant="outline"
              size="sm"
              className={css.syncBtn}
              onClick={(e) => {
                e.stopPropagation();
                onSyncPlanCrop();
              }}
              data-testid="sync-plan-crop"
            >
              Sync to latest
            </KitButton>
          ) : null}
        </div>
        <ResizeHandles onPointerDown={onPointerDown} />
        <PanelActions onRemove={onRemove} />
      </div>
    );
  }

  if (panel.kind === "swatch_board") {
    const selectedSwatches = panel.swatch_ids
      .map((id) => materials.find((m) => m.id === id))
      .filter((m): m is MaterialSwatch => m != null);
    return (
      <div
        ref={panelRef}
        className={css.panel}
        style={style}
        data-testid="present-panel"
        data-panel-kind="swatch_board"
        data-format-pending={formatGhost ? "1" : undefined}
        {...dragHandlers}
      >
        <div className={css.panelContent}>
          {selectedSwatches.length > 0 ? (
            <div
              className={css.swatchGrid}
              style={{ gridTemplateColumns: `repeat(${panel.columns}, 1fr)` }}
              data-testid="swatch-grid"
            >
              {selectedSwatches.map((sw) => (
                <div
                  key={sw.id}
                  className={css.swatchCell}
                  title={sw.label}
                  data-testid={`swatch-cell-${sw.id}`}
                >
                  <span
                    className={css.swatchChip}
                    style={{ background: sw.hex }}
                    aria-hidden
                  />
                  <span className={css.swatchLabel}>{sw.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={css.panelPlaceholder}>
              No swatches selected. Click "Edit swatches" to pick from the
              materials on this drawing.
            </p>
          )}
          {panel.caption ? (
            <p className={css.swatchCaption}>{panel.caption}</p>
          ) : null}
          <KitButton
            variant="ghost"
            size="sm"
            className={css.swatchEditBtn}
            onClick={(e) => {
              e.stopPropagation();
              onOpenSwatchPicker();
            }}
            data-testid="edit-swatch-btn"
          >
            Edit swatches
          </KitButton>
          {swatchPickerOpen ? (
            <SwatchPicker
              materials={materials}
              selectedIds={panel.swatch_ids}
              onToggle={onToggleSwatch}
              onClose={onCloseSwatchPicker}
            />
          ) : null}
        </div>
        <ResizeHandles onPointerDown={onPointerDown} />
        <PanelActions onRemove={onRemove} />
      </div>
    );
  }

  return null;
}

// --- Resize handles ---

function ResizeHandles({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent, mode: DragState["mode"]) => void;
}) {
  return (
    <>
      <div
        className={`${css.resizeHandle} ${css.resizeNw}`}
        onPointerDown={(e) => onPointerDown(e, "resize-nw")}
      />
      <div
        className={`${css.resizeHandle} ${css.resizeNe}`}
        onPointerDown={(e) => onPointerDown(e, "resize-ne")}
      />
      <div
        className={`${css.resizeHandle} ${css.resizeSw}`}
        onPointerDown={(e) => onPointerDown(e, "resize-sw")}
      />
      <div
        className={`${css.resizeHandle} ${css.resizeSe}`}
        onPointerDown={(e) => onPointerDown(e, "resize-se")}
      />
    </>
  );
}

// --- Panel actions (remove) ---

function PanelActions({ onRemove }: { onRemove: () => void }) {
  return (
    <KitButton
      variant="ghost"
      size="sm"
      className={css.panelRemove}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      aria-label="Remove panel"
    >
      Remove
    </KitButton>
  );
}

// --- Plan crop SVG renderer ---

/**
 * Renders the plan cropped to a rect. The SVG viewBox is set to the crop rect
 * (in board %), so only the cropped portion of the plan shows. Reuses the
 * SharePlanSvg pattern: boundary + building polygons, placement markers,
 * sketch strokes — all in board % coordinates.
 */
function PlanCropSvg({
  snapshot,
  crop,
}: {
  snapshot: PlanSnapshot;
  crop: { x_pct: number; y_pct: number; w_pct: number; h_pct: number };
}) {
  const { x_pct, y_pct, w_pct, h_pct } = crop;
  const boundaryPts = snapshot.boundary
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  const buildingPts = snapshot.building
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  return (
    <svg
      className={css.planCropSvg}
      viewBox={`${x_pct} ${y_pct} ${w_pct} ${h_pct}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="plan-crop-svg"
    >
      <rect
        x={x_pct}
        y={y_pct}
        width={w_pct}
        height={h_pct}
        style={{ fill: "var(--pv-plan-bg)" }}
      />
      {snapshot.items.map((item) => {
        if (item.outlinePct && item.outlinePct.length >= 3) {
          const pts = item.outlinePct
            .map((p) => `${p.x},${p.y}`)
            .join(" ");
          return (
            <polygon
              key={item.id}
              points={pts}
              style={{
                fill: "color-mix(in srgb, var(--planting-retain-stroke) 18%, transparent)",
                stroke: "var(--planting-retain-stroke)",
              }}
              strokeWidth="0.3"
            />
          );
        }
        return (
          <circle
            key={item.id}
            cx={item.x}
            cy={item.y}
            r="1"
            style={{ fill: "var(--planting-retain-stroke)" }}
            opacity="0.7"
          />
        );
      })}
      {snapshot.strokes.map((stroke) => {
        if (stroke.points.length < 2) return null;
        const d = freehandPath(stroke.points, {
          size: (stroke.widthPx ?? 2) * 0.15,
          thinning: 0.7,
          smoothing: 0.7,
          streamline: 0.5,
        });
        if (!d) return null;
        return (
          <path
            key={stroke.id}
            d={d}
            fill={stroke.color ?? "var(--proposed-stroke)"}
            opacity="0.75"
          />
        );
      })}
      {buildingPts ? (
        <polygon
          points={buildingPts}
          style={{
            fill: "color-mix(in srgb, var(--text-primary) 8%, transparent)",
            stroke: "var(--text-primary)",
          }}
          strokeWidth="0.3"
        />
      ) : null}
      {boundaryPts ? (
        <polygon
          points={boundaryPts}
          fill="none"
          style={{ stroke: "var(--text-primary)" }}
          strokeWidth="0.4"
        />
      ) : null}
    </svg>
  );
}

// --- Ghost review (plan dissection accept/reject) ---

function GhostReview({
  ghosts,
  onAccept,
  onAcceptAll,
  onReject,
  onClose,
}: {
  ghosts: PresentationDissectGhost[];
  onAccept: (index: number) => void;
  onAcceptAll: () => void;
  onReject: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <div className={css.ghostReview} data-testid="ghost-review">
      <div className={css.ghostReviewHeader}>
        <span className={css.ghostReviewTitle}>
          Plan dissection ({ghosts.length} panel{ghosts.length === 1 ? "" : "s"})
        </span>
        <KitButton
          variant="ghost"
          size="sm"
          className={css.ghostReviewClose}
          onClick={onClose}
          aria-label="Reject all proposals"
        >
          Reject all
        </KitButton>
      </div>
      {ghosts.length === 0 ? (
        <p className={css.ghostReviewEmpty}>
          No ghosts left. Dissect again for more proposals.
        </p>
      ) : (
        <>
          <KitButton
            variant="accent"
            size="sm"
            className={css.ghostAcceptAll}
            onClick={onAcceptAll}
            data-testid="ghost-accept-all"
          >
            Accept all
          </KitButton>
          <ul className={css.ghostList}>
            {ghosts.map((ghost, i) => (
              <li key={`${ghost.label}-${i}`} className={css.ghostItem}>
                <div className={css.ghostInfo}>
                  <span className={css.ghostLabel}>{ghost.label}</span>
                  <span className={css.ghostReason}>{ghost.reason}</span>
                  <span className={css.ghostCrop}>
                    {Math.round(ghost.crop.x_pct)},{Math.round(ghost.crop.y_pct)} —
                    {Math.round(ghost.crop.w_pct)}x{Math.round(ghost.crop.h_pct)}
                  </span>
                </div>
                <div className={css.ghostActions}>
                  <KitButton
                    variant="accent"
                    size="sm"
                    className={css.ghostAcceptBtn}
                    onClick={() => onAccept(i)}
                    data-testid={`ghost-accept-${i}`}
                  >
                    Accept
                  </KitButton>
                  <KitButton
                    variant="ghost"
                    size="sm"
                    className={css.ghostRejectBtn}
                    onClick={() => onReject(i)}
                    data-testid={`ghost-reject-${i}`}
                  >
                    Reject
                  </KitButton>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// --- Swatch picker (swatch board catalog wiring) ---

function SwatchPicker({
  materials,
  selectedIds,
  onToggle,
  onClose,
}: {
  materials: MaterialSwatch[];
  selectedIds: string[];
  onToggle: (swatchId: string) => void;
  onClose: () => void;
}) {
  const selected = new Set(selectedIds);
  return (
    <div className={css.swatchPicker} data-testid="swatch-picker">
      <div className={css.swatchPickerHeader}>
        <span className={css.swatchPickerTitle}>
          Materials on this drawing
        </span>
        <KitButton
          variant="accent"
          size="sm"
          className={css.swatchPickerClose}
          onClick={onClose}
          aria-label="Close swatch picker"
        >
          Done
        </KitButton>
      </div>
      {materials.length === 0 ? (
        <p className={css.swatchPickerEmpty}>
          No materials placed on the drawing yet. Place paving, decking,
          planting, or other materials on the design canvas first.
        </p>
      ) : (
        <ul className={css.swatchPickerList}>
          {materials.map((sw) => {
            const isOn = selected.has(sw.id);
            return (
              <li key={sw.id}>
                <button
                  type="button"
                  className={css.swatchPickerItem}
                  data-selected={isOn ? "1" : undefined}
                  data-testid={`swatch-pick-${sw.id}`}
                  onClick={() => onToggle(sw.id)}
                >
                  <span
                    className={css.swatchChip}
                    style={{ background: sw.hex }}
                    aria-hidden
                  />
                  <span className={css.swatchLabel}>{sw.label}</span>
                  <span className={css.swatchPickerCheck}>
                    {isOn ? "✓" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// --- Widget live content (Phase 4 — bind widgets to live estimate data) ---

function formatAUD(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function WidgetLiveContent({
  type,
  estimate,
}: {
  type: PresentationWidgetType;
  estimate: EstimateSnapshot | null;
}) {
  if (!estimate) {
    return (
      <p className={css.panelPlaceholder}>
        No estimate snapshot — cost the board before issuing, or reopen a draft deck.
      </p>
    );
  }
  switch (type) {
    case "quote_total":
      return (
        <div className={css.widgetLive} data-testid="widget-live-quote-total">
          <span className={css.widgetValue}>{formatAUD(estimate.totalInclGst)}</span>
          <span className={css.widgetSub}>incl. GST</span>
        </div>
      );
    case "savings_ledger":
      return (
        <div className={css.widgetLive}>
          <span className={css.widgetValue}>{estimate.lines.length} lines</span>
          <span className={css.widgetSub}>
            Materials ex-GST: {formatAUD(estimate.materialsExGst)}
          </span>
        </div>
      );
    case "zone_summary":
      return (
        <div className={css.widgetLive}>
          <span className={css.widgetValue}>
            {estimate.hardscapeM2.toFixed(0)} m² hardscape
          </span>
          <span className={css.widgetSub}>
            Excavation: {estimate.excavateM3.toFixed(0)} m³
          </span>
        </div>
      );
    case "material_swatches":
      return (
        <div className={css.widgetLive}>
          <span className={css.widgetValue}>
            {estimate.lines.length} materials
          </span>
          <span className={css.widgetSub}>Line items from live BOM</span>
        </div>
      );
    case "caption":
      return (
        <p className={css.panelPlaceholder}>
          Caption — edit to add descriptive text
        </p>
      );
    case "honesty_footer":
      return (
        <div className={css.widgetLive}>
          <p className={css.widgetText}>
            Indicative pricing only. Final quote subject to site conditions.
          </p>
          <p className={css.widgetSub}>
            Concept sketch for estimating — not a construction drawing.
          </p>
        </div>
      );
    case "ops_schedule":
      return (
        <div className={css.widgetLive} data-testid="widget-live-ops-schedule">
          <span className={css.widgetValue}>Ops schedules</span>
          <span className={css.widgetSub}>
            Planting · trench · lighting · material — confirm on site
          </span>
        </div>
      );
  }
}

// --- Format ghost overlay (visual preview of proposed layout on the page) ---

function FormatGhostOverlay({
  ghosts,
  onAccept,
  onReject,
}: {
  ghosts: PresentationFormatGhost[];
  onAccept: (panelId: string) => void;
  onReject: (panelId: string) => void;
}) {
  return (
    <div className={css.formatGhostLayer} data-testid="format-ghost-overlay">
      {ghosts.map((ghost) => (
        <div
          key={ghost.id}
          className={css.formatGhostBox}
          style={{
            left: `${ghost.rect.x_pct}%`,
            top: `${ghost.rect.y_pct}%`,
            width: `${ghost.rect.w_pct}%`,
            height: `${ghost.rect.h_pct}%`,
          }}
          data-testid={`format-ghost-${ghost.id}`}
        >
          <span className={css.formatGhostRationale}>{ghost.rationale}</span>
          <div className={css.formatGhostActions}>
            <KitButton
              variant="accent"
              size="sm"
              className={css.formatGhostAccept}
              onClick={(e) => {
                e.stopPropagation();
                onAccept(ghost.id);
              }}
              data-testid={`format-ghost-accept-${ghost.id}`}
            >
              Accept
            </KitButton>
            <KitButton
              variant="ghost"
              size="sm"
              className={css.formatGhostReject}
              onClick={(e) => {
                e.stopPropagation();
                onReject(ghost.id);
              }}
            >
              Reject
            </KitButton>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Format review (editorial formatting accept/reject) ---

function FormatReview({
  ghosts,
  rationale,
  onAccept,
  onAcceptAll,
  onReject,
  onClose,
}: {
  ghosts: PresentationFormatGhost[];
  rationale: string;
  onAccept: (panelId: string) => void;
  onAcceptAll: () => void;
  onReject: (panelId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className={css.formatReview} data-testid="format-review">
      <div className={css.ghostReviewHeader}>
        <span className={css.ghostReviewTitle}>
          Layout proposal ({ghosts.length} panel{ghosts.length === 1 ? "" : "s"})
        </span>
        <KitButton
          variant="ghost"
          size="sm"
          className={css.ghostReviewClose}
          onClick={onClose}
          aria-label="Reject all layout proposals"
        >
          Reject all
        </KitButton>
      </div>
      {rationale ? (
        <p className={css.formatRationale}>{rationale}</p>
      ) : null}
      {ghosts.length === 0 ? (
        <p className={css.ghostReviewEmpty}>
          No proposals left. Format again for a new layout pass.
        </p>
      ) : (
        <>
          <KitButton
            variant="accent"
            size="sm"
            className={css.ghostAcceptAll}
            onClick={onAcceptAll}
            data-testid="format-accept-all"
          >
            Accept all
          </KitButton>
          <ul className={css.ghostList}>
            {ghosts.map((ghost) => (
              <li key={ghost.id} className={css.ghostItem}>
                <div className={css.ghostInfo}>
                  <span className={css.ghostLabel}>{ghost.rationale}</span>
                  <span className={css.ghostCrop}>
                    {Math.round(ghost.rect.x_pct)},{Math.round(ghost.rect.y_pct)} —
                    {Math.round(ghost.rect.w_pct)}x{Math.round(ghost.rect.h_pct)}
                  </span>
                </div>
                <div className={css.ghostActions}>
                  <KitButton
                    variant="accent"
                    size="sm"
                    className={css.ghostAcceptBtn}
                    onClick={() => onAccept(ghost.id)}
                    data-testid={`format-accept-${ghost.id}`}
                  >
                    Accept
                  </KitButton>
                  <KitButton
                    variant="ghost"
                    size="sm"
                    className={css.ghostRejectBtn}
                    onClick={() => onReject(ghost.id)}
                  >
                    Reject
                  </KitButton>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
