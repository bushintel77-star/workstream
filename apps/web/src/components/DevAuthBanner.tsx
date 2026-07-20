import styles from "./dev-auth-banner.module.css";

export function DevAuthBanner({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <div className={styles.banner} role="status">
      <strong>Dev mode</strong>
      <span>Authentication is disabled. Do not treat this session as production-ready.</span>
    </div>
  );
}
