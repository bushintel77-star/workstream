"use client";

import { useState, useTransition } from "react";
import {
  cadQuoteAction,
  copyPortalLinkAction,
} from "../../../../../app/actions";
import css from "./share.module.css";

type Props = {
  projectId: string;
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

  if (draftUnverified) {
    return (
      <div className={css.root} data-testid="share-surface">
        <div className={css.card} data-testid="share-ai-draft-gate">
          <p className={css.kicker}>Share</p>
          <h2 className={css.title}>AI draft still open</h2>
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
      <div className={css.card}>
        <p className={css.kicker}>Share</p>
        <h2 className={css.title}>
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
                    await navigator.clipboard?.writeText(url);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2200);
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
