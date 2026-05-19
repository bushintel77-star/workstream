"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createQuotePortalLinkAction,
  type PortalLinkState,
} from "../app/actions";
import { useToast } from "./ToastHost";
import s from "../styles/app.module.css";
import o from "./outputs.module.css";

export function SendQuotePanel({
  projectId,
  ready,
  readyHint,
}: {
  projectId: string;
  ready: boolean;
  readyHint: string;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState(
    createQuotePortalLinkAction,
    null as PortalLinkState | null,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!state?.url) return;
    setCopied(false);
  }, [state?.url]);

  async function copyLink() {
    if (!state?.url) return;
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      toast.show("Client link copied to clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.show("Could not copy — select the link and copy manually.", "error");
    }
  }

  return (
    <div className={o.sendPanel}>
      <div className={o.sendPanelHead}>
        <span className={o.sendPanelTitle}>Send to client</span>
        <span className={o.sendPanelSub}>
          Secure link · 7-day expiry · Lean / Standard / Buffer on the portal
        </span>
      </div>

      {!ready ? (
        <p className={o.sendPanelWarn}>{readyHint}</p>
      ) : (
        <>
          <form action={formAction} className={o.sendPanelForm}>
            <input type="hidden" name="projectId" value={projectId} />
            <button
              type="submit"
              className={`${s.btn} ${s.btnAccent}`}
              disabled={pending}
            >
              {pending ? "Creating link…" : "Create client quote link"}
            </button>
          </form>

          {state?.error && (
            <p className={o.sendPanelError} role="alert">
              {state.error}
            </p>
          )}

          {state?.url && (
            <div className={o.linkBox}>
              <input
                className={o.linkInput}
                readOnly
                value={state.url}
                aria-label="Client quote link"
                onFocus={(e) => e.target.select()}
              />
              <div className={o.linkActions}>
                <button
                  type="button"
                  className={s.btnGhost}
                  onClick={copyLink}
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
                <a
                  href={state.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={s.btn}
                >
                  Preview portal
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
