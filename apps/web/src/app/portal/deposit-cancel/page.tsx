import styles from "../deposit/[token]/deposit.module.css";

export const runtime = "edge";

export default function DepositCancelPage() {
  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.brand}>Workstream</div>
        <span className={styles.kicker}>CHECKOUT CANCELLED</span>
      </header>

      <section className={styles.errorBlock}>
        <span className={styles.eyebrow}>NO PAYMENT TAKEN</span>
        <h1 className={styles.heading}>Your deposit checkout was cancelled.</h1>
        <p className={styles.body}>
          No charge has been made. Use the secure quote link again when you are
          ready, or contact your landscaper for a fresh link.
        </p>
      </section>
    </main>
  );
}
