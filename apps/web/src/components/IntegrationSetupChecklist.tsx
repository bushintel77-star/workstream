import Link from "next/link";
import type { IntegrationSummary } from "../lib/api";
import s from "../styles/app.module.css";
import styles from "./integration-setup.module.css";

export function IntegrationSetupChecklist({
  summary,
}: {
  summary: IntegrationSummary;
}) {
  const done = summary.next_steps.filter((x) => x.done).length;
  const total = summary.next_steps.length;
  if (done === total) return null;

  return (
    <section className={`${s.card} ${styles.checklist}`}>
      <div className={s.cardHead}>
        <h2 className={s.cardTitle}>Connect your stack</h2>
        <span className={`${s.pill} ${s.pillWarn}`}>
          {done}/{total} ready
        </span>
      </div>
      <p className={s.lede}>
        Lite keeps the full pipeline free for one user. Tick off each connector
        for a seamless path from sketch to CRM, email, and invoice.
      </p>
      <ol className={styles.steps}>
        {summary.next_steps.map((step) => (
          <li key={step.id} className={styles.step}>
            <span
              className={`${styles.stepMark} ${step.done ? styles.stepDone : ""}`}
              aria-hidden
            >
              {step.done ? "✓" : "○"}
            </span>
            <Link href={step.href} className={styles.stepLink}>
              {step.label}
            </Link>
          </li>
        ))}
      </ol>
      <Link href="/settings#hub" className={s.btn}>
        Open integration hub
      </Link>
    </section>
  );
}
