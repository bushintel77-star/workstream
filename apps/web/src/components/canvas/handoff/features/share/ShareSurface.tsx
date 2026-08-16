"use client";

import { useRef, useState, useTransition } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  cadQuoteAction,
  copyPortalLinkAction,
} from "../../../../../app/actions";
import css from "./share.module.css";

type Props = {
  projectId: string;
  verificationUnavailable?: boolean;
  draftUnverified: boolean;
  pendingGhosts: number;
  quotePersisted: boolean;
  portalUri: string | null;
  onQuotePersisted: (uri: string | null) => void;
  onReviewGhosts: () => void;
  onBack: () => void;
  onOpenSharePopup?: () => void;
};

/**
 * Share lens — promote quote + portal deposit link; revision share lives on
 * the header Share frost popup (checklist 9–12).
 */
export function ShareSurface({
  projectId,
  verificationUnavailable = false,
  draftUnverified,
  pendingGhosts,
  quotePersisted,
  portalUri,
  onQuotePersisted,
  onReviewGhosts,
  onBack,
  onOpenSharePopup,
}: Props) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(portalUri);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, cardRef, onBack);

  if (verificationUnavailable) {
    return (
      <div className={css.root} data-testid="share-surface">
        <div
          ref={cardRef}
          className={css.card}
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-verification-title"
        >
          <p className={css.kicker}>Share</p>
          <h2 id="share-verification-title" className={css.title}>
            CAD verification unavailable
          </h2>
          <p className={css.lead}>
            Workstream could not verify whether AI proposals are still staged.
            Reload the studio before creating a client link.
          </p>
          <button type="button" className={css.ghost} onClick={onBack}>
            Back to CAD
          </button>
        </div>
      </div>
    );
  }

  if (draftUnverified) {
    return (
      <div className={css.root} data-testid="share-surface">
        <div
          ref={cardRef}
          className={css.card}
          data-testid="share-ai-draft-gate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-ai-draft-title"
        >
          <p className={css.kicker}>Share</p>
          <h2 id="share-ai-draft-title" className={css.title}>
            AI draft still open
          </h2>
          <p className={css.lead}>
            {pendingGhosts} proposal{pendingGhosts === 1 ? "" : "s"} still need
            Accept or Reject before this looks client-ready.
          </p>
          <button type="button" className={css.primary} onClick={onReviewGhosts}>
            Review AI proposals
          </button>
          <button type="button" className={css.ghost} onClick={onBack}>
            Back to CAD
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={css.root} data-testid="share-surface">
      <div
        ref={cardRef}
        className={css.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <p className={css.kicker}>Share</p>
        <h2 id="share-title" className={css.title}>
          {quotePersisted ? "Client portal ready" : "Promote quote to unlock"}
        </h2>
        <p className={css.lead}>
          {quotePersisted
            ? "Copy a magic link for the homeowner — same Workstream quote, your brand on the portal."
            : "Persist an indicative quote from this drawing, then copy the client portal link."}
        </p>

        {!quotePersisted ? (
          <button
            type="button"
            className={css.primary}
            data-testid="share-promote-quote"
            disabled={pending}
            onClick={() => {
              setError(null);
              start(async () => {
                try {
                  const res = await cadQuoteAction(projectId, "standard");
                  const uri = res.output?.uri ?? null;
                  onQuotePersisted(uri);
                  setLink(uri);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not promote quote",
                  );
                }
              });
            }}
          >
            {pending ? "Promoting…" : "Promote live cost → quote"}
          </button>
        ) : (
          <div className={css.actions}>
            <button
              type="button"
              className={css.primary}
              data-testid="share-copy-portal"
              disabled={pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  try {
                    const url = await copyPortalLinkAction(projectId);
                    setLink(url);
                    try {
                      await navigator.clipboard?.writeText(url);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2200);
                    } catch {
                      // Clipboard permission denied or no secure context -
                      // the link is still set below for manual copy.
                    }
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Could not create portal link",
                    );
                  }
                });
              }}
            >
              {copied ? "Copied" : "Copy portal link"}
            </button>
            {link ? (
              <a
                className={css.secondary}
                href={link}
                target="_blank"
                rel="noreferrer"
                data-testid="share-open-portal"
              >
                Open portal
              </a>
            ) : null}
          </div>
        )}

        {error ? <p className={css.error}>{error}</p> : null}

        {onOpenSharePopup ? (
          <button
            type="button"
            className={css.primary}
            data-testid="share-open-revision-popup"
            onClick={onOpenSharePopup}
          >
            Client acceptance link
          </button>
        ) : null}

        <button type="button" className={css.ghost} onClick={onBack}>
          Back to CAD
        </button>

        <p className={css.defer} data-testid="share-walk-defer">
          Digital Clay Walk — coming on geo survey; this share stays a 2D portal
          link for Workflow 1.
        </p>
      </div>
    </div>
  );
}
