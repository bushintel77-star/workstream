"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { BoardDisclaimer, ShareRevision } from "@workstream/contracts";
import { shareSnapshotFingerprint } from "@workstream/contracts";
import {
  createShareRevisionAction,
  downloadCadDxfAction,
  downloadCadGltfAction,
  downloadCadSyncAction,
  listShareRevisionsAction,
} from "../../../../../app/actions";
import { useToast } from "../../../../ToastHost";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { ExportLiabilityPrompt } from "./ExportLiabilityPrompt";
import { SafetyWaiverConfirm } from "./SafetyWaiverConfirm";
import { resolveShareLiabilityGate } from "./shareLiabilityGate";
import kit from "../chromeKit/summonedDock.module.css";
import css from "./shareRevisionPopup.module.css";

type QuoteLine = {
  id: string;
  label: string;
  unit: string;
  qty: number;
  total: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  address: string;
  quoteLines: QuoteLine[];
  totalInclGst: number;
  /** Optional canvas fingerprint inputs — omit canvas when not loaded. */
  canvasFingerprint?: unknown;
  /** Notices this board's content implies — prompted before the set is issued. */
  disclaimers?: BoardDisclaimer[];
  onRevisionChange?: (latest: ShareRevision | null) => void;
};

function formatStatus(rev: ShareRevision): string {
  if (rev.status === "accepted" && rev.decision) {
    const d = new Date(rev.decision.decidedAt);
    const date = d.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `Accepted by ${rev.decision.clientName}, ${date}`;
  }
  if (rev.status === "declined" && rev.decision) {
    const d = new Date(rev.decision.decidedAt);
    const date = d.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `Declined by ${rev.decision.clientName}, ${date}`;
  }
  if (rev.status === "shared") return `Rev ${rev.revision} · Shared with client`;
  if (rev.status === "superseded") return `Rev ${rev.revision} · Superseded`;
  return `Rev ${rev.revision}`;
}

function shareUrlFor(
  rev: ShareRevision,
  shareBaseUrl: string | null,
): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/share/${rev.token}`;
  }
  return shareBaseUrl
    ? `${shareBaseUrl}/${rev.token}`
    : `/share/${rev.token}`;
}

/**
 * Frost share popup — lives on the existing Share header control (checklist 9–12).
 */
export function ShareRevisionPopup({
  open,
  onClose,
  projectId,
  address,
  quoteLines,
  totalInclGst,
  canvasFingerprint,
  disclaimers = [],
  onRevisionChange,
}: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revisions, setRevisions] = useState<ShareRevision[]>([]);
  const [shareBaseUrl, setShareBaseUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenDecisionRef = useRef<string | null>(null);
  const primedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  /** List/poll must not share `pending` with submit — that locked the CTA on
   * "Sharing…" for the whole refresh and looked like a hung CI actionability wait. */
  const refreshInFlight = useRef(false);

  const latest = revisions[0] ?? null;
  const currentOpen =
    revisions.find((r) => r.status === "shared") ?? null;

  const unchanged = useMemo(() => {
    if (!latest) return false;
    const next = {
      canvas: (canvasFingerprint as null) ?? null,
      quoteLines,
      totalInclGst,
      address,
    };
    // Fingerprint without live canvas object identity — quote + address + total.
    return (
      shareSnapshotFingerprint({
        canvas: null,
        quoteLines: latest.snapshot.quoteLines,
        totalInclGst: latest.snapshot.totalInclGst,
        address: latest.snapshot.address,
      }) ===
      shareSnapshotFingerprint({
        canvas: null,
        quoteLines: next.quoteLines,
        totalInclGst: next.totalInclGst,
        address: next.address,
      })
    );
  }, [latest, quoteLines, totalInclGst, address, canvasFingerprint]);

  const refresh = () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    void (async () => {
      try {
        const data = await listShareRevisionsAction(projectId);
        setRevisions(data.revisions);
        setShareBaseUrl(data.share_base_url);
        onRevisionChange?.(data.revisions[0] ?? null);

        const decided = data.revisions.find(
          (r) =>
            (r.status === "accepted" || r.status === "declined") &&
            r.decision,
        );
        if (decided?.decision) {
          const key = `${decided.id}:${decided.decision.decidedAt}`;
          if (primedRef.current && seenDecisionRef.current !== key) {
            toast.show(
              decided.status === "accepted"
                ? `Accepted by ${decided.decision.clientName}`
                : `Declined by ${decided.decision.clientName}`,
              "success",
            );
          }
          seenDecisionRef.current = key;
        }
        primedRef.current = true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load shares");
      } finally {
        refreshInFlight.current = false;
      }
    })();
  };

  useEffect(() => {
    if (!open) return;
    refresh();
    const id = window.setInterval(refresh, 12_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on open only; projectId is route-scoped and cannot change without remounting the popup (Next.js App Router remounts on route change), so the refresh closure is never stale
  }, [open, projectId]);

  // Esc/trap/autofocus/restore — gated on !confirmOpen so the nested
  // SafetyWaiverConfirm alertdialog owns Escape and Tab while it is up.
  useFocusTrap(open && !confirmOpen, panelRef, onClose);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const el = panelRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        const shareBtn = (e.target as HTMLElement).closest?.(
          '[data-testid="share-top"]',
        );
        if (shareBtn) return;
        onClose();
      }
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open, onClose]);

  const submitShare = () => {
    setError(null);
    start(async () => {
      try {
        const result = await createShareRevisionAction(
          projectId,
          quoteLines,
          totalInclGst,
        );
        if (!result.ok) {
          setError(result.error);
          setRevisions((prev) => {
            const rest = prev.filter((r) => r.id !== result.revision.id);
            return [result.revision, ...rest];
          });
          return;
        }
        setRevisions((prev) => {
          const marked = prev.map((r) =>
            r.status === "shared"
              ? { ...r, status: "superseded" as const }
              : r,
          );
          return [
            result.revision,
            ...marked.filter((r) => r.id !== result.revision.id),
          ];
        });
        onRevisionChange?.(result.revision);
        try {
          await navigator.clipboard?.writeText(result.share_url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2200);
        } catch {
          // Clipboard permission denied; still toast share success below.
        }
        toast.show(
          `Rev ${result.revision.revision} shared — link copied`,
          "success",
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create share");
      }
    });
  };

  const downloadDxf = () => {
    setError(null);
    start(async () => {
      try {
        const dxf = await downloadCadDxfAction(projectId);
        const blob = new Blob([dxf], { type: "application/dxf" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `workstream-plan-${projectId.slice(0, 8)}.dxf`;
        a.click();
        URL.revokeObjectURL(href);
        toast.show(
          "DXF downloaded — working plan metres, confirm on site",
          "info",
        );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not download DXF",
        );
      }
    });
  };

  const downloadGltf = () => {
    setError(null);
    start(async () => {
      try {
        const gltf = await downloadCadGltfAction(projectId);
        const blob = new Blob([gltf], { type: "model/gltf+json" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `workstream-plan-${projectId.slice(0, 8)}.gltf`;
        a.click();
        URL.revokeObjectURL(href);
        toast.show(
          "glTF downloaded — working plan metres, confirm on site",
          "info",
        );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not download glTF",
        );
      }
    });
  };

  const downloadSync = () => {
    setError(null);
    start(async () => {
      try {
        const json = await downloadCadSyncAction(projectId);
        const blob = new Blob([json], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `workstream-plan-${projectId.slice(0, 8)}.sync.json`;
        a.click();
        URL.revokeObjectURL(href);
        toast.show(
          "UE5 sync manifest downloaded — poll glTF with the same auth",
          "info",
        );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not download sync manifest",
        );
      }
    });
  };

  if (!open) return null;

  const active = currentOpen ?? latest;
  /*
   * Inferred notices warn and relabel but never block — the tool can be wrong
   * about geometry, and refusing to issue on a bad inference costs more than it
   * saves. The required safety waiver is the exception and hard-confirms.
   */
  const gate = resolveShareLiabilityGate(disclaimers, acknowledged);
  const outstanding = gate.softOutstanding;

  return (
    <div
      className={`${kit.dock} ${css.popup}`}
      ref={panelRef}
      role="dialog"
      aria-label="Share with client"
      data-testid="share-revision-popup"
    >
      <p className={`${kit.kicker} ${css.kicker}`}>Share</p>
      <h2 className={css.title}>
        {active ? formatStatus(active) : "Share with client"}
      </h2>
      <p className={css.lead}>
        {active
          ? "Copy the link for the homeowner. DXF / glTF / UE5 sync are working plan metres — confirm on site."
          : "Capture this quote as an immutable revision. Download DXF, glTF, or the UE5 sync manifest."}
      </p>

      {active ? (
        <div className={css.actions}>
          <button
            type="button"
            className={css.primary}
            data-testid="share-copy-link"
            disabled={pending || active.status === "superseded"}
            onClick={() => {
              setError(null);
              start(async () => {
                try {
                  const url = shareUrlFor(active, shareBaseUrl);
                  try {
                    await navigator.clipboard?.writeText(url);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2200);
                  } catch {
                    // Clipboard permission denied; continue with the URL.
                  }
                  toast.show("Link copied", "success");
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not copy link",
                  );
                }
              });
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            className={css.secondary}
            data-testid="share-download-dxf"
            disabled={pending}
            title="Working plan metres — confirm on site"
            onClick={downloadDxf}
          >
            Download DXF
          </button>
          <button
            type="button"
            className={css.secondary}
            data-testid="share-download-gltf"
            disabled={pending}
            title="Working plan metres — confirm on site"
            onClick={downloadGltf}
          >
            Download glTF
          </button>
          <button
            type="button"
            className={css.secondary}
            data-testid="share-download-sync"
            disabled={pending}
            title="UE5 live-sync manifest — stable asset IDs"
            onClick={downloadSync}
          >
            UE5 sync
          </button>
        </div>
      ) : (
        <div className={css.actions}>
          <button
            type="button"
            className={css.secondary}
            data-testid="share-download-dxf"
            disabled={pending}
            title="Working plan metres — confirm on site"
            onClick={downloadDxf}
          >
            Download DXF
          </button>
          <button
            type="button"
            className={css.secondary}
            data-testid="share-download-gltf"
            disabled={pending}
            title="Working plan metres — confirm on site"
            onClick={downloadGltf}
          >
            Download glTF
          </button>
          <button
            type="button"
            className={css.secondary}
            data-testid="share-download-sync"
            disabled={pending}
            title="UE5 live-sync manifest — stable asset IDs"
            onClick={downloadSync}
          >
            UE5 sync
          </button>
        </div>
      )}

      <ExportLiabilityPrompt
        disclaimers={disclaimers}
        accepted={acknowledged}
        onToggle={(id, next) =>
          setAcknowledged((prev) => ({ ...prev, [id]: next }))
        }
      />

      <button
        type="button"
        className={css.secondary}
        data-testid="share-new-revision"
        disabled={pending || unchanged || quoteLines.length === 0}
        title={
          unchanged
            ? "Nothing changed since the last share"
            : quoteLines.length === 0
              ? "Nothing costed yet"
              : "Share a new revision"
        }
        onClick={() => {
          // A required safety waiver is answered before the set moves.
          if (gate.hardConfirm) {
            setConfirmOpen(true);
            return;
          }
          submitShare();
        }}
      >
        {pending
          ? "Sharing…"
          : gate.hardConfirm
            ? "Review safety notice"
            : outstanding > 0
              ? "Share without acknowledging"
              : "Share new revision"}
      </button>
      {outstanding > 0 ? (
        <p className={css.hint} data-testid="share-liability-outstanding">
          {outstanding} required notice{outstanding === 1 ? "" : "s"} still
          unacknowledged — this set would go out without {outstanding === 1 ? "it" : "them"}.
        </p>
      ) : null}
      {unchanged ? (
        <p className={css.hint} data-testid="share-unchanged-hint">
          Nothing changed since the last share — edit the drawing or quote
          first.
        </p>
      ) : null}

      {error ? <p className={css.error}>{error}</p> : null}

      <button type="button" className={css.ghost} onClick={onClose}>
        Close
      </button>

      {confirmOpen && (
        <SafetyWaiverConfirm
          disclaimer={gate.hardConfirm}
          onConfirm={() => {
            setConfirmOpen(false);
            setAcknowledged((prev) => ({
              ...prev,
              [gate.hardConfirm!.id]: true,
            }));
            submitShare();
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
