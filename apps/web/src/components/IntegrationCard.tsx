"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Integration } from "../lib/api";
import {
  clearIntegrationAction,
  setIntegrationAction,
} from "../app/actions";
import s from "../styles/app.module.css";
import styles from "../app/settings/settings.module.css";
import { SubmitButton } from "./SubmitButton";
import { useToast } from "./ToastHost";
import { Button, Dialog } from "./ui";

export function IntegrationCard({ integration: i }: { integration: Integration }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);

  const pillClass =
    i.source === "store"
      ? s.pillOk
      : i.source === "env"
        ? s.pillInfo
        : s.pillMuted;
  const pillText = i.live
    ? "Live"
    : i.source === "store"
      ? "Saved"
      : i.source === "env"
        ? "Fly secret"
        : "Not set";
  const pillClassLive = i.live ? s.pillOk : pillClass;
  const fmtUpdated = i.updated_at
    ? new Date(i.updated_at).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    })
    : null;

  function run(action: (fd: FormData) => Promise<void>, success: string) {
    return (fd: FormData) => {
      startTransition(async () => {
        try {
          await action(fd);
          toast.show(success, "success", 3000);
          router.refresh();
        } catch (e) {
          toast.show(
            e instanceof Error ? e.message : "Request failed",
            "error",
            5000,
          );
        }
      });
    };
  }

  return (
    <li className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <span className={styles.label}>{i.label}</span>
          <span className={styles.envName}>{i.key}</span>
        </div>
        <span className={`${s.pill} ${pillClassLive}`}>{pillText}</span>
      </div>

      <p className={styles.description}>{i.description}</p>

      {i.configured && i.last4 && (
        <div className={styles.maskRow}>
          {"•".repeat(Math.min(20, (i.length ?? 4) - 4))}
          {i.last4}
          {fmtUpdated && i.source === "store" ? ` · updated ${fmtUpdated}` : ""}
        </div>
      )}

      <form action={run(setIntegrationAction, `${i.label} saved`)} className={styles.form}>
        <input type="hidden" name="key" value={i.key} />
        <label className={styles.label} htmlFor={`integration-${i.key}`}>
          {i.label} token
          <input
            id={`integration-${i.key}`}
            className={styles.input}
            name="value"
            type="password"
            placeholder={i.placeholder}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
          />
        </label>
        <SubmitButton pendingLabel="Saving…" disabled={pending}>
          {i.source === "store" ? "Replace" : "Save"}
        </SubmitButton>
        {i.source === "store" && (
          <>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmClear(true)}
            >
              Clear
            </Button>
            <Dialog
              open={confirmClear}
              onClose={() => setConfirmClear(false)}
              title="Clear token?"
              destructive
              footer={
                <>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setConfirmClear(false);
                      const fd = new FormData();
                      fd.set("key", i.key);
                      startTransition(async () => {
                        await run(clearIntegrationAction, `${i.label} cleared`)(fd);
                      });
                    }}
                  >
                    Clear
                  </Button>
                </>
              }
            >
              <p>
                Clear saved <strong>{i.label}</strong> token? You can re-enter it later.
              </p>
            </Dialog>
          </>
        )}
      </form>
    </li>
  );
}
