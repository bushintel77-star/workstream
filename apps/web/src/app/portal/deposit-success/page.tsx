import styles from "../deposit/[token]/deposit.module.css";

export const runtime = "edge";

export default function DepositSuccessPage() {
  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.brand}>Curtis &amp; Co</div>
        <span className={styles.kicker}>DEPOSIT RECEIVED</span>
      </header>

      <section className={styles.successBlock}>
        <span className={styles.eyebrow}>NEXT STEP</span>
        <h1 className={styles.heading}>Thank you. Your deposit is confirmed.</h1>
        <p className={styles.body}>
          Curtis &amp; Co will reconcile the payment and confirm your project
          start window directly.
        </p>
        <p className={styles.bodyMuted}>
          You can now close this page, or return to the quote link sent by your
          landscaper.
        </p>
      </section>
    </main>
  );
}
