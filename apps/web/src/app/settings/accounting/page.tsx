import Link from "next/link";
import { getMyobStatus, getXeroStatus } from "../../../lib/api";
import s from "../../../styles/app.module.css";
import { SettingsMasthead } from "../SettingsShell";
import { Button } from "../../../components/ui";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const [myob, xero] = await Promise.all([getMyobStatus(), getXeroStatus()]);
  // The status helpers degrade to null when the API call fails, so a pair of
  // nulls means the connection is down — surface that rather than a silent blank.
  const error =
    myob === null && xero === null
      ? "Accounting status could not be loaded. Check the API connection and try again."
      : null;

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .replace(",", "")
        .replace(" at ", " · ")
      : "—";

  return (
    <main className={s.pageNarrow}>
      <SettingsMasthead active="accounting" subtitle="Accounting" />

      <h1 className={s.headline}>Accounting</h1>
      <p className={s.lede}>
        MYOB AccountRight and Xero parallel integrations. Set the relevant
        secrets on the Integrations tab to go live — without them, invoice
        drafts use canned customers and items so the rest of the pipeline keeps
        working.
      </p>

      {error ? (
        <section className={s.card} role="alert">
          <h2 className={s.cardTitle}>Accounting status unavailable</h2>
          <p className={s.dim}>{error}</p>
          <Link href="/settings/accounting" passHref>
            <Button as="a" size="sm">Retry</Button>
          </Link>
        </section>
      ) : null}

      <h2 className={s.sectionHeading}>MYOB</h2>
      <div className={s.card}>
        <div className={s.cardHead}>
          <h3 className={s.cardTitle}>AccountRight</h3>
          <span
            className={`${s.pill} ${myob?.connected ? s.pillOk : s.pillMuted}`}
          >
            {myob?.connected ? "Live" : "Dev fallback"}
          </span>
        </div>
        {myob ? (
          <dl className={s.statusList}>
            <Pair k="Company file" v={myob.company_file_id ?? "—"} />
            <Pair k="Customers cached" v={String(myob.customers_cached ?? 0)} />
            <Pair k="Items cached" v={String(myob.items_cached ?? 0)} />
            <Pair k="SKU match" v={`${myob.sku_match_pct ?? 0}%`} />
            <Pair k="Last sync" v={fmt(myob.last_sync_at)} />
          </dl>
        ) : (
          <p className={s.dim}>Status unavailable.</p>
        )}
      </div>

      <h2 className={s.sectionHeading}>Xero</h2>
      <div className={s.card}>
        <div className={s.cardHead}>
          <h3 className={s.cardTitle}>Xero</h3>
          <span
            className={`${s.pill} ${xero?.connected ? s.pillOk : s.pillMuted}`}
          >
            {xero?.connected ? "Live" : "Dev fallback"}
          </span>
        </div>
        {xero ? (
          <dl className={s.statusList}>
            <Pair k="Tenant" v={xero.tenant_id ?? "—"} />
            <Pair k="Contacts cached" v={String(xero.contacts_cached ?? 0)} />
            <Pair k="Items cached" v={String(xero.items_cached ?? 0)} />
            <Pair k="Last sync" v={fmt(xero.last_sync_at)} />
          </dl>
        ) : (
          <p className={s.dim}>Status unavailable.</p>
        )}
      </div>
    </main>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className={s.statusPair}>
      <dt className={s.statusKey}>{k}</dt>
      <dd className={s.statusVal}>{v}</dd>
    </div>
  );
}
