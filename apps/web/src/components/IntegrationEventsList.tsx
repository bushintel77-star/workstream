import type { IntegrationEvent } from "../lib/api";
import s from "../styles/app.module.css";
import styles from "./integration-setup.module.css";

export function IntegrationEventsList({ events }: { events: IntegrationEvent[] }) {
  if (events.length === 0) {
    return (
      <p className={s.lede}>
        No integration events yet — create a project or sync a quote to see
        activity.
      </p>
    );
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <ul className={styles.events}>
      {events.map((e) => (
        <li key={e.id} className={styles.eventRow}>
          <div>
            <span
              className={`${s.pill} ${e.ok ? s.pillOk : s.pillBlock}`}
            >
              {e.channel}
            </span>{" "}
            <span>{e.event}</span>
          </div>
          <span>{e.detail}</span>
          <span className={styles.eventMeta}>{fmt(e.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
