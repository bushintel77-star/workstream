"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CrmStage, Project } from "../lib/api";
import {
  copyPortalLinkAction,
  saveProjectClientAction,
  syncQuotePackAction,
} from "../app/actions";
import s from "../styles/app.module.css";
import styles from "./integration-setup.module.css";
import handoff from "./project-client.module.css";
import { useToast } from "./ToastHost";

const STAGES: Array<{ id: CrmStage; label: string }> = [
  { id: "enquiry", label: "Enquiry" },
  { id: "quote_sent", label: "Quote sent" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export function ProjectClientHandoff({
  project,
  quoteUrl,
  hasQuote,
  lastCrmDetail,
}: {
  project: Pick<
    Project,
    "id" | "client_name" | "client_email" | "crm_stage" | "crm_synced_at"
  >;
  quoteUrl: string | null;
  hasQuote: boolean;
  lastCrmDetail: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<CrmStage>(
    project.crm_stage ?? "enquiry",
  );

  const syncedLabel = project.crm_synced_at
    ? new Date(project.crm_synced_at).toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("crm_stage", stage);
    const intent = fd.get("intent");
    startTransition(async () => {
      try {
        await saveProjectClientAction(fd);
        if (intent === "send" && hasQuote) {
          const email = String(fd.get("client_email") ?? "").trim();
          if (email) fd.set("to_email", email);
          const result = await syncQuotePackAction(fd);
          toast.show(
            result.ok
              ? "Quote pack sent — client record synced"
              : "Saved — enable Studio + CRM webhook in Settings to sync",
            result.ok ? "success" : "error",
            6000,
          );
        } else {
          toast.show("Client saved", "success");
        }
        router.refresh();
      } catch (err) {
        toast.show(err instanceof Error ? err.message : "Action failed", "error");
      }
    });
  }

  return (
    <section className={`${s.card} ${styles.handoff}`}>
      <div className={s.cardHead}>
        <h2 className={s.cardTitle}>Client</h2>
        {syncedLabel ? (
          <span className={`${s.pill} ${s.pillOk}`}>Synced {syncedLabel}</span>
        ) : (
          <span className={`${s.pill} ${s.pillMuted}`}>Not synced yet</span>
        )}
      </div>
      <p className={s.lede}>
        Curtis &amp; Co — one screen for client, quote and portal. Zoho updates in
        the background; you stay in Workstream.
      </p>
      {lastCrmDetail ? (
        <p className={handoff.syncNote}>{lastCrmDetail}</p>
      ) : null}

      <form className={handoff.clientForm} onSubmit={handleSubmit}>
        <input type="hidden" name="projectId" value={project.id} />

        <label className={s.label}>
          Client name
          <input
            className={s.input}
            name="client_name"
            defaultValue={project.client_name ?? ""}
            placeholder="Eleanor Marsh"
          />
        </label>
        <label className={s.label}>
          Client email
          <input
            className={s.input}
            name="client_email"
            type="email"
            defaultValue={project.client_email ?? ""}
            placeholder="client@example.com"
          />
        </label>

        <fieldset className={handoff.stageFieldset}>
          <legend className={handoff.stageLegend}>Pipeline stage</legend>
          <div className={handoff.stageRow}>
            {STAGES.map((st) => (
              <button
                key={st.id}
                type="button"
                className={`${handoff.stageBtn} ${stage === st.id ? handoff.stageBtnActive : ""}`}
                onClick={() => setStage(st.id)}
                disabled={pending}
              >
                {st.label}
              </button>
            ))}
          </div>
        </fieldset>

        {hasQuote && (
          <label className={s.checkboxRow}>
            <input
              type="checkbox"
              name="include_portal"
              value="1"
              defaultChecked
            />
            Include portal link when syncing
          </label>
        )}

        <div className={styles.hubActions}>
          <button
            type="submit"
            name="intent"
            value="save"
            className={s.btnGhost}
            disabled={pending}
          >
            {pending ? "Saving…" : "Save client"}
          </button>
          {hasQuote && (
            <button
              type="submit"
              name="intent"
              value="send"
              className={s.btnAccent}
              disabled={pending}
            >
              {pending ? "Sending…" : "Save and send quote pack"}
            </button>
          )}
        </div>
      </form>

      {hasQuote ? (
        <div className={styles.handoffGrid}>
          <div>
            <h3 className={s.sectionHeading}>Client portal</h3>
            <div className={styles.copyRow}>
              <input
                className={styles.copyInput}
                readOnly
                value={portalUrl ?? "Generate link…"}
                aria-label="Client portal URL"
              />
              <button
                type="button"
                className={s.btnGhost}
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const url = await copyPortalLinkAction(project.id);
                      setPortalUrl(url);
                      await navigator.clipboard.writeText(url);
                      toast.show("Portal link copied", "success");
                    } catch (e) {
                      toast.show(
                        e instanceof Error ? e.message : "Failed",
                        "error",
                      );
                    }
                  });
                }}
              >
                Copy link
              </button>
            </div>
          </div>
          <div>
            <h3 className={s.sectionHeading}>Quote</h3>
            {quoteUrl ? (
              <a
                href={quoteUrl}
                className={s.btnGhost}
                target="_blank"
                rel="noreferrer"
              >
                Open quote
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <a href={`/projects/${project.id}/outputs`} className={s.btn}>
          Generate quote
        </a>
      )}

      <p className={handoff.footnote}>
        Open Zoho only when you want the full CRM view — routine updates happen
        from here.
      </p>
    </section>
  );
}
