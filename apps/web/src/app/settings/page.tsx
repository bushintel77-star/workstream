import Link from "next/link";
import { requireSignedIn } from "../../lib/auth";
import {
  getIntegrationHub,
  type IntegrationChannelStatus,
  type IntegrationEvent,
  type IntegrationSummary,
  type WorkspaceBilling,
  type WorkspaceLicense,
} from "../../lib/api";
import { AppNav } from "../../components/AppNav";
import settings from "./settings.module.css";

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function channelState(row: IntegrationChannelStatus): {
  label: string;
  tone: "live" | "configured" | "fallback" | "none";
} {
  if (row.live) return { label: "Live", tone: "live" };
  if (row.configured) return { label: "Configured — dev fallback", tone: "configured" };
  if (row.channel === "datavic") return { label: "Keyless floor on", tone: "live" };
  return { label: "Not set", tone: "none" };
}

/**
 * Settings hub — the workspace's real integration state, read live from
 * `/integrations/hub` (billing, channels, events, summary, license).
 */
export default async function SettingsPage() {
  await requireSignedIn();
  const hub = await getIntegrationHub().catch(() => null);

  const billing: WorkspaceBilling | null = hub?.billing ?? null;
  const channels: IntegrationChannelStatus[] = hub?.channels ?? [];
  const events: IntegrationEvent[] = hub?.events ?? [];
  const summary: IntegrationSummary | null = hub?.summary ?? null;
  const license: WorkspaceLicense | null = hub?.license ?? null;

  return (
    <main className={settings.page}>
      <AppNav summary={summary} brandSub />

      <header className={settings.header}>
        <p className={settings.kicker}>Workspace</p>
        <h1 className={settings.heading}>Settings</h1>
        <p className={settings.copy}>
          Plans, seats and the live integration state for this workspace.
          Everything on this page is read from the API — nothing is mocked.
        </p>
      </header>

      {hub === null ? (
        <section className={settings.card} role="status" data-testid="settings-unavailable">
          Settings hub unavailable — the API could not be reached.
        </section>
      ) : (
        <>
          <div className={settings.grid}>
            <section className={settings.card} aria-labelledby="workspace-heading">
              <h2 id="workspace-heading" className={settings.cardHeading}>
                Workspace
              </h2>
              <dl className={settings.metrics}>
                <div className={settings.metric}>
                  <dt>Plan</dt>
                  <dd className={settings.planValue}>
                    {billing?.plan === "studio" ? "Studio" : "Lite"}
                  </dd>
                </div>
                <div className={settings.metric}>
                  <dt>Seats</dt>
                  <dd>
                    {summary?.seats_used ?? license?.seats_used ?? 0}/
                    {billing?.seat_limit ?? license?.seat_limit ?? 1}
                  </dd>
                </div>
                <div className={settings.metric}>
                  <dt>Live channels</dt>
                  <dd>
                    {summary?.live_channels ?? 0}/{summary?.total_channels ?? 8}
                  </dd>
                </div>
              </dl>
              {summary?.needs_attention ? (
                <ul className={settings.nextSteps} aria-label="Next steps">
                  {summary.next_steps.map((step) => (
                    <li key={step.id} data-done={step.done}>
                      <Link href={step.href} className={settings.nextLink}>
                        {step.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={settings.note}>No setup steps pending.</p>
              )}
            </section>

            <section className={settings.card} aria-labelledby="license-heading">
              <h2 id="license-heading" className={settings.cardHeading}>
                License
              </h2>
              <p className={settings.licenseLine}>
                {license?.product_name ?? "Design & Build License"} ·{" "}
                {license?.live_integrations ? "live integrations" : "dev fallbacks"}
              </p>
              <p className={settings.note}>
                {license?.seats_used ?? 0} of {license?.seat_limit ?? 1} seats in use.
              </p>
              <Link href="/settings/license" className={settings.cardLink}>
                Manage license &amp; seats
              </Link>
            </section>
          </div>

          <section className={settings.card} aria-labelledby="integrations-heading">
            <h2 id="integrations-heading" className={settings.cardHeading}>
              Integrations
            </h2>
            <ul className={settings.channels} data-testid="settings-channels">
              {channels.map((row) => {
                const state = channelState(row);
                return (
                  <li className={settings.channelRow} key={row.channel}>
                    <span className={settings.channelLabel}>{row.label}</span>
                    <span className={settings.channelNote}>{row.note}</span>
                    <span
                      className={settings.statusChip}
                      data-tone={state.tone}
                      data-testid={`channel-${row.channel}`}
                    >
                      {state.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={settings.card} aria-labelledby="events-heading">
            <h2 id="events-heading" className={settings.cardHeading}>
              Recent events
            </h2>
            {events.length === 0 ? (
              <p className={settings.note}>No integration events yet.</p>
            ) : (
              <ul className={settings.events} data-testid="settings-events">
                {events.slice(0, 8).map((event) => (
                  <li className={settings.eventRow} key={event.id}>
                    <span className={settings.eventChannel}>{event.channel}</span>
                    <span className={settings.eventName}>{event.event}</span>
                    <span className={settings.eventDetail}>{event.detail}</span>
                    <span className={settings.eventTime}>
                      {DATE_FORMAT.format(new Date(event.created_at))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className={settings.source}>
            Live from the API — <code>/integrations/hub</code>. This page shows
            the workspace&apos;s real integration state.
          </p>
        </>
      )}
    </main>
  );
}
