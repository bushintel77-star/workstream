import styles from "./deposit.module.css";

export const runtime = "edge";

export default function LoadingDepositPortal() {
  return (
    <main className={styles.page} aria-busy="true">
      <header className={styles.masthead}>
        <div className={styles.brand}>Workstream</div>
        <span className={styles.kicker}>DEPOSIT</span>
      </header>
      <section className={styles.successBlock}>
        <span className={styles.eyebrow}>SECURE CHECKOUT</span>
        <h1 className={styles.heading}>Opening checkout...</h1>
        <p className={styles.body}>
          Preparing the secure deposit hand-off for this quote.
        </p>
      </section>
    </main>
  );
}

