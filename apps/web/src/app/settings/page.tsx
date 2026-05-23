import {
  getIntegrationHub,
  listIntegrations,
  type Integration,
  type IntegrationCategory,
} from "../../lib/api";
import s from "../../styles/app.module.css";
import styles from "./settings.module.css";
import { SettingsMasthead } from "./SettingsShell";
import { IntegrationCard } from "../../components/IntegrationCard";
import { IntegrationHubPanel } from "../../components/IntegrationHubPanel";
import { IntegrationEventsList } from "../../components/IntegrationEventsList";
import { SettingsUpgradeToast } from "../../components/SettingsUpgradeToast";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  ai: "AI services",
  payments: "Payments",
  geo: "Geocoding & mapping",
  auth: "Auth",
  accounting: "Accounting",
  crm: "CRM — Zoho (via n8n)",
  email: "Email",
};

const CATEGORY_ORDER: IntegrationCategory[] = [
  "ai",
  "geo",
  "payments",
  "auth",
  "accounting",
  "crm",
  "email",
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ studio?: string }>;
}) {
  const sp = await searchParams;
  let integrations: Integration[] = [];
  let billing = null as Awaited<ReturnType<typeof listIntegrations>>["billing"] | null;
  let hub: Awaited<ReturnType<typeof getIntegrationHub>> | null = null;
  let loadError: string | null = null;
  try {
    const listed = await listIntegrations();
    integrations = listed.items;
    billing = listed.billing;
    hub = await getIntegrationHub();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not reach the API.";
  }

  const grouped = new Map<IntegrationCategory, Integration[]>();
  for (const i of integrations) {
    const arr = grouped.get(i.category) ?? [];
    arr.push(i);
    grouped.set(i.category, arr);
  }

  return (
    <main className={s.pageNarrow}>
      <SettingsUpgradeToast status={sp.studio} />
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

      {billing && hub && (
        <IntegrationHubPanel
          billing={billing}
          channels={hub.channels}
          events={hub.events}
          summary={hub.summary}
        />
      )}

      {hub && hub.events.length > 0 && (
        <section className={s.card}>
          <h2 className={s.sectionHeading}>Recent activity</h2>
          <IntegrationEventsList events={hub.events} />
        </section>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        return (
          <section key={cat} id={cat}>
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
