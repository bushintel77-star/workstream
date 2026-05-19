import { listIntegrations, type Integration } from "../../lib/api";
import s from "../../styles/app.module.css";
import {
  clearIntegrationAction,
  setIntegrationAction,
} from "../actions";
import styles from "./settings.module.css";
import { SettingsMasthead } from "./SettingsShell";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<Integration["category"], string> = {
  ai: "AI services",
  payments: "Payments",
  geo: "Geocoding & mapping",
  auth: "Auth",
  accounting: "Accounting",
};

const CATEGORY_ORDER: Integration["category"][] = [
  "ai",
  "geo",
  "payments",
  "auth",
  "accounting",
];

export default async function SettingsPage() {
  let integrations: Integration[] = [];
  let loadError: string | null = null;
  try {
    integrations = await listIntegrations();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not reach the API.";
  }

  const grouped = new Map<Integration["category"], Integration[]>();
  for (const i of integrations) {
    const arr = grouped.get(i.category) ?? [];
    arr.push(i);
    grouped.set(i.category, arr);
  }

  return (
    <main className={s.pageNarrow}>
      <SettingsMasthead active="integrations" subtitle="Integrations" />

      <h1 className={s.headline}>Integrations</h1>
      <p className={s.lede}>
        Tokens for the external services Workstream talks to. Saved here for
        operator review; the API also reads any matching Fly secret as a
        fallback.
      </p>

      <div className={s.banner}>
        Saved tokens live in the API&apos;s in-memory store right now — they
        survive until the Fly machine restarts. Persist them by setting the
        matching Fly secret (or wait until the volume mount is re-enabled).
      </div>

      {loadError && (
        <div className={s.error}>
          Couldn&apos;t load integrations: {loadError}
        </div>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className={s.sectionHeading}>{CATEGORY_LABELS[cat]}</h2>
            <ul className={styles.list}>
              {items.map((i) => (
                <IntegrationCard key={i.key} integration={i} />
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

function IntegrationCard({ integration: i }: { integration: Integration }) {
  const pillClass =
    i.source === "store"
      ? s.pillOk
      : i.source === "env"
        ? s.pillInfo
        : s.pillMuted;
  const pillText =
    i.source === "store"
      ? "Saved"
      : i.source === "env"
        ? "Fly secret"
        : "Not set";
  const fmtUpdated = i.updated_at
    ? new Date(i.updated_at).toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <li className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <span className={styles.label}>{i.label}</span>
          <span className={styles.envName}>{i.key}</span>
        </div>
        <span className={`${s.pill} ${pillClass}`}>{pillText}</span>
      </div>

      <p className={styles.description}>{i.description}</p>

      {i.configured && i.last4 && (
        <div className={styles.maskRow}>
          {"•".repeat(Math.min(20, (i.length ?? 4) - 4))}
          {i.last4}
          {fmtUpdated && i.source === "store" ? ` · updated ${fmtUpdated}` : ""}
        </div>
      )}

      <form action={setIntegrationAction} className={styles.form}>
        <input type="hidden" name="key" value={i.key} />
        <input
          className={styles.input}
          name="value"
          type="password"
          placeholder={i.placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className={s.btn}>
          {i.source === "store" ? "Replace" : "Save"}
        </button>
        {i.source === "store" && (
          <button
            type="submit"
            className={s.btnDanger}
            formAction={clearIntegrationAction}
          >
            Clear
          </button>
        )}
      </form>
    </li>
  );
}
