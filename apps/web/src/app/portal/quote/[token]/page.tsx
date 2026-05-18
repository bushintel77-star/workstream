import Link from "next/link";
import { fetchPortalQuote } from "../../../../lib/api";
import styles from "./quote.module.css";

const aud0 = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

const aud2 = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(n);

export default async function QuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchPortalQuote(token);

  if ("error" in data) {
    return (
      <main className={styles.errorPage}>
        <span className={styles.kicker}>LINK EXPIRED OR INVALID</span>
        <h1 className={styles.errorHeading}>This quote link can't be opened.</h1>
        <p className={styles.errorBody}>
          The studio can issue a fresh link from the project — links expire
          after 7 days for your security.
        </p>
      </main>
    );
  }

  const { project, survey, design, costing } = data;
  const generated = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.brand}>
          Curtis &amp; Co
          <span className={styles.brandSub}>
            Boutique Landscape Design · Melbourne
          </span>
        </div>
        <div className={styles.docMeta}>
          <strong>QUOTE</strong>
          {generated}
        </div>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>PREPARED FOR YOU</span>
        <h1 className={styles.address}>{project.address}</h1>
      </section>

      {survey && (
        <section className={styles.summary}>
          <Metric label="LOT" value={`${survey.lot_area_m2} m²`} />
          <Metric label="HOUSE" value={`${survey.house_area_m2} m²`} />
          <Metric label="GARDEN" value={`${survey.garden_area_m2} m²`} />
        </section>
      )}

      {design && (
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>The design</h2>
          <p className={styles.rationale}>{design.rationale}</p>
          {design.proposal.zones.map((z) => (
            <div key={z.id} className={styles.zone}>
              <h3 className={styles.zoneName}>{z.name}</h3>
              <p className={styles.zoneTreatment}>{z.treatment}</p>
            </div>
          ))}
        </section>
      )}

      {costing && (
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Investment</h2>
          <div className={styles.total}>
            <span className={styles.totalKicker}>
              {costing.scenario.toUpperCase()} · TOTAL INCL. GST
            </span>
            <span className={styles.totalAmount}>
              {aud0(costing.total)}
            </span>
            <span className={styles.totalSub}>
              Subtotal {aud2(costing.subtotal)} · GST {aud2(costing.gst)}
            </span>
          </div>

          <table className={styles.lineItems}>
            <thead>
              <tr>
                <th>Item</th>
                <th className={styles.alignRight}>Qty</th>
                <th className={styles.alignRight}>Rate</th>
                <th className={styles.alignRight}>Total</th>
              </tr>
            </thead>
            <tbody>
              {costing.line_items
                .filter((li) => !li.is_provisional)
                .map((li, i) => (
                  <tr key={i}>
                    <td>{li.label}</td>
                    <td className={styles.alignRight}>
                      {li.qty} {li.unit}
                    </td>
                    <td className={styles.alignRight}>{aud2(li.rate)}</td>
                    <td className={styles.alignRight}>{aud0(li.total)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      <section className={styles.acceptSection}>
        <Link
          href={`/portal/deposit/${token}`}
          className={styles.acceptButton}
        >
          Accept &amp; pay deposit →
        </Link>
        <p className={styles.acceptNote}>
          A 20% deposit secures your project. Balance billed in stages as the
          works progress.
        </p>
      </section>

      <footer className={styles.colophon}>
        <span>Curtis &amp; Co · {project.address}</span>
        <span>Quote valid 30 days</span>
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}
