"use client";

import styles from "./quote/[token]/quote.module.css";

export default function PortalError({ reset }: { reset: () => void }) {
  return (
    <main className={styles.errorPage}>
      <span className={styles.kicker}>PORTAL TEMPORARILY UNAVAILABLE</span>
      <h1 className={styles.errorHeading}>We couldn't load this client portal.</h1>
      <p className={styles.errorBody}>
        Please try again. If the issue continues, contact your landscaper for a
        fresh secure link.
      </p>
      <button type="button" className={styles.acceptButton} onClick={reset}>
        Try again
      </button>
    </main>
  );
}
