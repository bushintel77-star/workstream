import styles from "./dev-auth-banner.module.css";

export function DevAuthBanner() {
  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.kicker}>DEV MODE</span>
      <span className={styles.copy}>
        Auth is disabled and operator requests use the shared dev-user identity.
        Do not use this mode for client work.
      </span>
    </div>
  );
}
