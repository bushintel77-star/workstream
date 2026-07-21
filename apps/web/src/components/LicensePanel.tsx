"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceLicense } from "../lib/api";
import {
  inviteWorkspaceMemberAction,
  removeWorkspaceMemberAction,
  startSeatCheckoutAction,
  startStudioCheckoutAction,
  upgradePlanAction,
} from "../app/actions";
import s from "../styles/app.module.css";
import styles from "../app/settings/settings.module.css";
import { useToast } from "./ToastHost";

export function LicensePanel({
  license,
  studioPriceConfigured,
  seatPriceConfigured,
}: {
  license: WorkspaceLicense;
  studioPriceConfigured: boolean;
  seatPriceConfigured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const isStudio = license.plan === "studio";

  function runStudioCheckout() {
    startTransition(async () => {
      try {
        const { checkout_url, mode } = await startStudioCheckoutAction();
        if (mode === "dev_fallback") {
          toast.show("Design & Build License unlocked (dev)", "success");
          router.refresh();
          return;
        }
        window.location.href = checkout_url;
      } catch (e) {
        toast.show(e instanceof Error ? e.message : "Checkout failed", "error");
      }
    });
  }

  function runSeatCheckout() {
    startTransition(async () => {
      try {
        const { checkout_url, mode, seat_limit } =
          await startSeatCheckoutAction(1);
        if (mode === "dev_fallback") {
          toast.show(`Seat limit now ${seat_limit} (dev)`, "success");
          router.refresh();
          return;
        }
        window.location.href = checkout_url;
      } catch (e) {
        toast.show(e instanceof Error ? e.message : "Seat checkout failed", "error");
      }
    });
  }

  function inviteMember() {
    const userId = window.prompt("Clerk user id for the operator seat")?.trim();
    if (!userId) return;
    startTransition(async () => {
      try {
        await inviteWorkspaceMemberAction(userId);
        toast.show("Operator seat added", "success");
        router.refresh();
      } catch (e) {
        toast.show(e instanceof Error ? e.message : "Invite failed", "error");
      }
    });
  }

  return (
    <section className={s.card} data-testid="license-panel">
      <div className={s.cardHead}>
        <h2 className={s.cardTitle}>{license.product_name}</h2>
        <span className={`${s.pill} ${isStudio ? s.pillOk : s.pillInfo}`}>
          {isStudio ? "Studio · live integrations" : "Lite · 1 operator"}
        </span>
      </div>

      <p className={s.lede}>
        Full design-to-build pipeline for your workspace. Lite is free for one
        operator with safe fallbacks. Studio unlocks live AI, Mapbox, Stripe,
        MYOB/Xero, and extra seats.
      </p>

      <dl className={styles.licenseStats}>
        <div>
          <dt>Plan</dt>
          <dd>{isStudio ? "Studio" : "Lite"}</dd>
        </div>
        <div>
          <dt>Seats</dt>
          <dd>
            {license.seats_used} / {license.seat_limit}
          </dd>
        </div>
        <div>
          <dt>Live connectors</dt>
          <dd>{license.live_integrations ? "Unlocked" : "Fallback only"}</dd>
        </div>
      </dl>

      <div className={styles.hubActions}>
        {!isStudio ? (
          <>
            <button
              type="button"
              className={s.btn}
              disabled={pending}
              onClick={runStudioCheckout}
            >
              {pending
                ? "Starting..."
                : studioPriceConfigured
                  ? "Upgrade to Studio"
                  : "Unlock Studio (dev)"}
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnGhost}`}
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await upgradePlanAction("studio");
                  toast.show("Studio unlocked (dev)", "success");
                  router.refresh();
                });
              }}
            >
              Dev unlock
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={s.btn}
              disabled={pending}
              onClick={runSeatCheckout}
            >
              {pending
                ? "Starting..."
                : seatPriceConfigured
                  ? "Add seat"
                  : "Add seat (dev)"}
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnGhost}`}
              disabled={pending || license.seats_available <= 0}
              onClick={inviteMember}
            >
              Invite operator
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnGhost}`}
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await upgradePlanAction("lite");
                  toast.show("Back to Lite", "success");
                  router.refresh();
                });
              }}
            >
              Switch to Lite (dev)
            </button>
          </>
        )}
      </div>

      <h3 className={styles.licenseMembersTitle}>Workspace members</h3>
      <table className={s.table}>
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {license.members.map((m) => (
            <tr key={m.user_id}>
              <td>
                <code className={styles.memberId}>{m.user_id}</code>
              </td>
              <td>{m.role}</td>
              <td>
                {m.role !== "owner" ? (
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnGhost}`}
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await removeWorkspaceMemberAction(m.user_id);
                          toast.show("Seat freed", "success");
                          router.refresh();
                        } catch (e) {
                          toast.show(
                            e instanceof Error ? e.message : "Remove failed",
                            "error",
                          );
                        }
                      });
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
