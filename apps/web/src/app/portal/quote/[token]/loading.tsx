import styles from "./quote.module.css";

export const runtime = "edge";

export default function LoadingQuotePortal() {
  return (
    <main className={styles.page} aria-busy="true">
      <header className={styles.masthead}>
        <div className={styles.brand}>
          Workstream
          <span className={styles.brandSub}>Quote portal</span>
        </div>
        <div className={styles.docMeta}>
          <span className={styles.skeletonLineShort} />
          <strong className={styles.skeletonLineTiny} />
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonLineWide} />
        <div className={styles.skeletonLine} />
      </section>

      <section className={styles.summary}>
        <div className={styles.skeletonCard} />
        <div className={styles.skeletonCard} />
        <div className={styles.skeletonCard} />
      </section>
    </main>
  );
}

