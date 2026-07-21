import { redirect } from "next/navigation";
import { createDepositCheckout } from "../../../../lib/portal-api";
import styles from "./deposit.module.css";

export const runtime = "edge";

export default async function DepositPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await createDepositCheckout(token);

  // Live Stripe → redirect straight to the hosted Checkout
  if (result.session?.checkout_url && result.session.mode === "live") {
    redirect(result.session.checkout_url);
  }

  // Fallback / error -> render a client-safe interstitial page.
  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.brand}>Curtis &amp; Co</div>
        <span className={styles.kicker}>DEPOSIT</span>
      </header>

      {result.error && (
        <section className={styles.errorBlock}>
          <h1 className={styles.heading}>Couldn't open checkout</h1>
          <p className={styles.body}>
            This deposit link is not available right now. Contact your
            landscaper and they will issue a fresh checkout link.
          </p>
        </section>
      )}

      {result.session && result.session.mode === "dev_fallback" && (
        <section className={styles.successBlock}>
          <span className={styles.eyebrow}>DEPOSIT HOLD</span>
          <h1 className={styles.heading}>
            {new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency: "AUD",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(result.session.deposit_amount_aud)}{" "}
            deposit noted
          </h1>
          <p className={styles.body}>
            Online checkout is not available for this quote right now. Curtis
            &amp; Co has the deposit amount on file and will confirm payment
            options directly.
          </p>
          <p className={styles.bodyMuted}>
            If you need a fresh link, contact your landscaper.
          </p>
        </section>
      )}
    </main>
  );
}
