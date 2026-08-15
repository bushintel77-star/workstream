"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceLicense } from "../lib/api";
import {
  inviteWorkspaceMemberAction,
  removeWorkspaceMemberAction,
  startSeatCheckoutAction,
  startStudioCheckoutAction,
} from "../app/actions";
import { KitButton } from "./ui/kit/KitButton";
import css from "./settingsLicense.module.css";

const DATE_FORMAT = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type CheckoutState = "idle" | "busy" | "error";

/**
 * Workspace license surface — plan, seats, Stripe checkout, members.
 * This is the page the checkout success/cancel URLs return to, so the
 * ?studio=/?seats= banners close the loop.
 */
export function SettingsLicenseSurface({
  license,
  studioPriceConfigured,
  seatPriceConfigured,
  banner,
}: {
  license: WorkspaceLicense | null;
  studioPriceConfigured: boolean;
  seatPriceConfigured: boolean;
  banner: { kind: "studio" | "seats"; result: "success" | "cancel" } | null;
}) {
  const router = useRouter();
  const [studioState, setStudioState] = useState<CheckoutState>("idle");
  const [seatState, setSeatState] = useState<CheckoutState>("idle");
  const [inviteId, setInviteId] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const goCheckout = async (
    which: "studio" | "seats",
    action: () => Promise<{ checkout_url: string }>,
    setState: (s: CheckoutState) => void,
  ) => {
    setState("busy");
    setMessage(null);
    try {
      const res = await action();
      window.location.assign(res.checkout_url);
    } catch (err) {
      setState("error");
      setMessage(
        err instanceof Error ? err.message : `${which} checkout failed`,
      );
    }
  };

  return (
    <main className={css.page}>
      <header className={css.hero}>
        <p className={css.kicker}>Workspace</p>
        <h1 className={css.headline}>License &amp; seats</h1>
        <p className={css.copy}>
          The Design &amp; Build License covers the studio plan and operator
          seats. Checkout runs through Stripe; changes apply immediately.
        </p>
        {banner ? (
          <p
            className={css.banner}
            data-result={banner.result}
            role="status"
            data-testid="license-banner"
          >
            {banner.result === "success"
              ? banner.kind === "studio"
                ? "Studio plan checkout complete."
                : "Seat checkout complete."
              : "Checkout cancelled — nothing was charged."}
          </p>
        ) : null}
      </header>

      {license ? (
        <>
          <section className={css.card} aria-label="License summary">
            <div className={css.licenseRow}>
              <div>
                <p className={css.licensePlan} data-testid="license-plan">
                  {license.plan === "studio" ? "Studio" : "Lite"}
                </p>
                <p className={css.licenseMeta}>
                  {license.product_name} ·{" "}
                  {license.live_integrations
                    ? "live integrations"
                    : "dev fallbacks"}
                </p>
              </div>
              <div className={css.seats}>
                <span className={css.seatFigure}>
                  {license.seats_used}/{license.seat_limit}
                </span>
                <span className={css.seatLabel}>seats</span>
              </div>
            </div>
            <div className={css.actions}>
              {license.plan === "studio" ? (
                <span className={css.note}>Studio plan active.</span>
              ) : (
                <KitButton
                  variant="accent"
                  loading={studioState === "busy"}
                  disabled={!studioPriceConfigured}
                  onClick={() =>
                    goCheckout(
                      "studio",
                      () => startStudioCheckoutAction(),
                      setStudioState,
                    )
                  }
                  data-testid="studio-checkout"
                >
                  Upgrade to Studio
                </KitButton>
              )}
              <KitButton
                variant="secondary"
                loading={seatState === "busy"}
                disabled={!seatPriceConfigured}
                onClick={() =>
                  goCheckout("seats", () => startSeatCheckoutAction(), setSeatState)
                }
                data-testid="seat-checkout"
              >
                Add a seat
              </KitButton>
              {!studioPriceConfigured || !seatPriceConfigured ? (
                <span className={css.note}>
                  Checkout prices are not configured on this environment.
                </span>
              ) : null}
            </div>
          </section>

          <section className={css.card} aria-labelledby="members-heading">
            <h2 id="members-heading" className={css.sectionHeading}>
              Members
            </h2>
            {license.members.map((member) => (
              <div className={css.memberRow} key={member.user_id}>
                <div className={css.memberMain}>
                  <span className={css.memberId}>{member.user_id}</span>
                  <span className={css.memberMeta}>
                    {member.role} · joined {DATE_FORMAT.format(new Date(member.joined_at))}
                  </span>
                </div>
                {member.role !== "owner" ? (
                  <KitButton
                    variant="ghost"
                    size="sm"
                    disabled={memberBusy}
                    onClick={async () => {
                      setMemberBusy(true);
                      setMessage(null);
                      try {
                        await removeWorkspaceMemberAction(member.user_id);
                        router.refresh();
                      } catch (err) {
                        setMessage(
                          err instanceof Error ? err.message : "Remove failed",
                        );
                      } finally {
                        setMemberBusy(false);
                      }
                    }}
                  >
                    Remove
                  </KitButton>
                ) : null}
              </div>
            ))}
            <div className={css.inviteRow}>
              <label className={css.label}>
                Add member by user ID
                <input
                  type="text"
                  value={inviteId}
                  onChange={(e) => setInviteId(e.target.value)}
                  placeholder="user_…"
                  data-testid="invite-member-id"
                />
              </label>
              <KitButton
                variant="secondary"
                disabled={!inviteId.trim() || memberBusy}
                onClick={async () => {
                  setMemberBusy(true);
                  setMessage(null);
                  try {
                    await inviteWorkspaceMemberAction(inviteId.trim());
                    setInviteId("");
                    router.refresh();
                  } catch (err) {
                    setMessage(
                      err instanceof Error ? err.message : "Invite failed",
                    );
                  } finally {
                    setMemberBusy(false);
                  }
                }}
                data-testid="invite-member-submit"
              >
                Add member
              </KitButton>
            </div>
          </section>
        </>
      ) : (
        <div className={css.card} role="status">
          License details are unavailable — the API could not be reached.
        </div>
      )}

      {message ? (
        <p className={css.banner} data-result="error" role="alert">
          {message}
        </p>
      ) : null}
    </main>
  );
}
