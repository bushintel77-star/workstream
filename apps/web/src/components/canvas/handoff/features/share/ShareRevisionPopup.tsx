"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ShareRevision } from "@workstream/contracts";
import { shareSnapshotFingerprint } from "@workstream/contracts";
import {
  createShareRevisionAction,
  listShareRevisionsAction,
} from "../../../../../app/actions";
import { useToast } from "../../../../ToastHost";
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
  onRevisionChange,
}: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [revisions, setRevisions] = useState<ShareRevision[]>([]);
  const [shareBaseUrl, setShareBaseUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenDecisionRef = useRef<string | null>(null);
  const primedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
    start(async () => {
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
      }
    });
  };

  useEffect(() => {
    if (!open) return;
    refresh();
    const id = window.setInterval(refresh, 12_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on open only
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

  if (!open) return null;

  const active = currentOpen ?? latest;

  return (
    <div
      className={css.popup}
      ref={panelRef}
      role="dialog"
      aria-label="Share with client"
      data-testid="share-revision-popup"
    >
      <p className={css.kicker}>Share</p>
      <h2 className={css.title}>
        {active ? formatStatus(active) : "Share with client"}
      </h2>
      <p className={css.lead}>
        {active
          ? "Copy the link for the homeowner. A new share supersedes the open revision."
          : "Capture this quote as an immutable revision the client can accept."}
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
                  await navigator.clipboard?.writeText(url);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2200);
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
        </div>
      ) : null}

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
              await navigator.clipboard?.writeText(result.share_url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2200);
              toast.show(
                `Rev ${result.revision.revision} shared — link copied`,
                "success",
              );            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not create share",
              );
            }
          });
        }}
      >
        {pending ? "Sharing…" : "Share new revision"}
      </button>
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
    </div>
  );
}
