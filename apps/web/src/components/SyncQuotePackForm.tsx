"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncQuotePackAction } from "../app/actions";
import s from "../styles/app.module.css";
import { SubmitButton } from "./SubmitButton";
import { useToast } from "./ToastHost";

export function SyncQuotePackForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={s.card}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            const result = await syncQuotePackAction(fd);
            toast.show(
              `CRM: ${result.crm ? "ok" : "skipped"} · Email: ${result.email ? "ok" : "skipped"}`,
              result.ok ? "success" : "error",
              6000,
            );
            router.refresh();
          } catch (err) {
            toast.show(
              err instanceof Error ? err.message : "Sync failed",
              "error",
            );
          }
        });
      }}
    >
      <h2 className={s.cardTitle}>Sync to CRM and email</h2>
      <p className={s.lede}>
        Pushes quote URL to your CRM webhook and optionally emails the client
        (Studio + Resend). Requires a generated quote.
      </p>
      <input type="hidden" name="projectId" value={projectId} />
      <label className={s.label}>
        Client name
        <input className={s.input} name="client_name" placeholder="Eleanor Marsh" />
      </label>
      <label className={s.label}>
        Client email
        <input
          className={s.input}
          name="to_email"
          type="email"
          placeholder="client@example.com"
        />
      </label>
      <label className={s.checkboxRow}>
        <input type="checkbox" name="include_portal" value="1" defaultChecked />
        Include portal link in CRM payload and email
      </label>
      <SubmitButton className={s.btn} pendingLabel="Syncing…" disabled={pending}>
        Sync quote pack
      </SubmitButton>
    </form>
  );
}
