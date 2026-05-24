import type { ActivityEvent } from "../lib/api";
import s from "../styles/app.module.css";
import styles from "./activity-timeline.module.css";

const ACTION_LABEL: Record<ActivityEvent["action"], string> = {
  "project.deleted": "Project deleted",
  "project.restored": "Project restored",
  "project_file.deleted": "File removed",
  "crew_member.deleted": "Crew removed",
  "catalog_symbol.deleted": "Asset removed",
  "integration.deleted": "Integration cleared",
  "sku_link.deleted": "SKU link removed",
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityTimeline({
  events,
  emptyMessage = "No activity recorded yet.",
}: {
  events: ActivityEvent[];
  emptyMessage?: string;
}) {
  if (events.length === 0) {
    return <p className={s.brandSub}>{emptyMessage}</p>;
  }

  return (
    <ul className={styles.list}>
      {events.map((ev) => (
        <li key={ev.id} className={styles.item}>
          <div className={styles.head}>
            <span className={styles.action}>{ACTION_LABEL[ev.action]}</span>
            <time className={styles.when} dateTime={ev.created_at}>
              {fmtWhen(ev.created_at)}
            </time>
          </div>
          <p className={styles.detail}>{ev.detail}</p>
        </li>
      ))}
    </ul>
  );
}
