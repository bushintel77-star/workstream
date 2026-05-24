import { redirect } from "next/navigation";
import { createDepositCheckout } from "../../../../lib/api";
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

  // Dev fallback / error → render an interstitial page
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
          <span className={styles.eyebrow}>DEV FALLBACK</span>
          <h1 className={styles.heading}>
            {new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency: "AUD",
              maximumFractionDigits: 0,
            }).format(result.session.deposit_amount_aud)}{" "}
            deposit ready
          </h1>
          <p className={styles.body}>
            Stripe isn't configured on this API, so we'd normally redirect
            to the hosted Checkout. With{" "}
            <code>STRIPE_SECRET_KEY</code> set this same flow lands on
            Stripe's payment page.
          </p>
          <p className={styles.bodyMuted}>Session id: {result.session.session_id}</p>
        </section>
      )}
    </main>
  );
}
