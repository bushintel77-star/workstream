"use client";

import { useEffect } from "react";
import styles from "./quote/[token]/quote.module.css";
import { KitButton } from "../../components/ui/kit";

export const runtime = "edge";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <main className={styles.errorPage}>
      <span className={styles.kicker}>PORTAL TEMPORARILY UNAVAILABLE</span>
      <h1 className={styles.errorHeading}>We couldn't load this client portal.</h1>
      <p className={styles.errorBody}>
        Please try again. If the issue continues, contact your landscaper for a
        fresh secure link.
      </p>
      <KitButton variant="accent" size="lg" onClick={reset}>
        Try again
      </KitButton>
    </main>
  );
}
