"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  IntegrationChannelStatus,
  IntegrationEvent,
  IntegrationSummary,
  WorkspaceBilling,
} from "../lib/api";
import {
  startStudioCheckoutAction,
  testIntegrationAction,
  upgradePlanAction,
} from "../app/actions";
import s from "../styles/app.module.css";
import styles from "../app/settings/settings.module.css";
import { useToast } from "./ToastHost";

export function IntegrationHubPanel({
  billing,
  channels,
  events,
  summary,
}: {
  billing: WorkspaceBilling;
  channels: IntegrationChannelStatus[];
  events: IntegrationEvent[];
  summary: IntegrationSummary;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const planPill = billing.plan === "studio" ? s.pillOk : s.pillInfo;
  const liveCount = channels.filter((c) => c.live).length;

  function runTest(channel: string) {
    startTransition(async () => {
      try {
        const email =
          channel === "email"
            ? window.prompt("Test email address")?.trim()
            : undefined;
        if (channel === "email" && !email) return;
        const result = await testIntegrationAction(channel, email);
        toast.show(result.detail, result.ok ? "success" : "error", 5000);
        router.refresh();
      } catch (e) {
        toast.show(e instanceof Error ? e.message : "Test failed", "error");
      }
    });
  }

  function runCheckout() {
    startTransition(async () => {
      try {
        const { checkout_url, mode } = await startStudioCheckoutAction();
        if (mode === "dev_fallback") {
          toast.show("Studio enabled (dev — no Stripe price configured)", "success");
          router.refresh();
          return;
        }
        window.location.href = checkout_url;
      } catch (e) {
        toast.show(e instanceof Error ? e.message : "Checkout failed", "error");
      }
    });
  }

  return (
    <section id="hub" className={s.card}>
      <div className={s.cardHead}>
        <h2 className={s.cardTitle}>Integration hub</h2>
        <span className={`${s.pill} ${planPill}`}>
          {billing.plan === "studio"
            ? "Design & Build · Studio"
            : "Design & Build · Lite"}
        </span>
      </div>
      <p className={s.lede}>
        {liveCount} of {channels.length} channels live. Manage the{" "}
        <a href="/settings/license">Design &amp; Build License</a> for seats and
        Studio unlock. Zoho CRM Free via n8n; Resend; MYOB/Xero/Stripe on Studio.
      </p>

      <div className={styles.hubActions}>
        {billing.plan === "lite" ? (
          <>
            <button
              type="button"
              className={s.btn}
              disabled={pending}
              onClick={runCheckout}
            >
              {pending ? "Starting…" : "Upgrade to Studio"}
            </button>
            <button
              type="button"
              className={s.btnGhost}
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await upgradePlanAction("studio");
                  toast.show("Studio enabled (dev)", "success");
                  router.refresh();
                });
              }}
            >
              Dev unlock
            </button>
          </>
        ) : (
          <button
            type="button"
            className={s.btnGhost}
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await upgradePlanAction("lite");
                toast.show("Lite plan", "success");
                router.refresh();
              });
            }}
          >
            Switch to Lite (dev)
          </button>
        )}
      </div>

      <table className={s.table}>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {channels.map((c) => (
            <tr key={c.channel}>
              <td>{c.label}</td>
              <td>
                <span
                  className={`${s.pill} ${c.live ? s.pillOk : c.configured ? s.pillWarn : s.pillMuted}`}
                >
                  {c.live ? "Live" : c.configured ? "Saved" : "Not set"}
                </span>
                {c.note ? (
                  <span className={styles.channelNote}>{c.note}</span>
                ) : null}
              </td>
              <td>
                <button
                  type="button"
                  className={s.btnGhost}
                  disabled={pending}
                  onClick={() => runTest(c.channel)}
                >
                  Test
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {summary.needs_attention && (
        <p className={s.banner}>
          Finish setup below — scroll to each section (AI, CRM, email, accounting).
        </p>
      )}
    </section>
  );
}
