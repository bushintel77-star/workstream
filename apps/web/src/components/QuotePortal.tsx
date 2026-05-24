"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "../app/portal/quote/[token]/quote.module.css";

export type PortalCosting = {
  scenario: string;
  subtotal: number;
  gst: number;
  total: number;
  line_items: Array<{
    label: string;
    qty: number;
    unit: string;
    rate: number;
    total: number;
    is_provisional: boolean;
    sku?: string;
  }>;
};

export type PortalQuoteData = {
  project: { id: string; address: string; created_at: string };
  survey: {
    lot_area_m2: number;
    house_area_m2: number;
    garden_area_m2: number;
  } | null;
  design: {
    rationale: string;
    proposal: {
      zones: Array<{ id: string; name: string; treatment: string }>;
    };
  } | null;
  costing: PortalCosting | null;
  costings?: PortalCosting[];
  deposit_url?: string | null;
  tier1?: {
    removed_ex: number;
    deployed_ex: number;
    net_ex: number;
    net_inc_gst: number;
    target_total_inc_gst: number;
  } | null;
  hero_url?: string | null;
};

const SCENARIOS = [
  {
    id: "lean",
    label: "Lean",
    note: "Tighter materials - pavers, bin, lights substituted with disclosure.",
  },
  {
    id: "standard",
    label: "Standard",
    note: "Tier-1 redesign as specified. Curtis recommended scope.",
  },
  {
    id: "buffer",
    label: "Buffer",
    note: "Premium stock + 6% scope contingency on top of margin.",
  },
] as const;

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

export function QuotePortal({
  data,
}: {
  data: PortalQuoteData;
}) {
  const { project, survey, design, tier1 } = data;
  const allCostings = data.costings?.length
    ? data.costings
    : data.costing
      ? [data.costing]
      : [];

  const [scenario, setScenario] = useState("standard");
  const active =
    allCostings.find((c) => c.scenario === scenario) ??
    allCostings.find((c) => c.scenario === "standard") ??
    allCostings[0] ??
    null;

  const generated = useMemo(
    () =>
      new Date().toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.brand}>
          Curtis &amp; Co
          <span className={styles.brandSub}>
            Boutique Landscape Design - Melbourne
          </span>
        </div>
        <div className={styles.docMeta}>
          <strong>QUOTE</strong>
          {generated}
        </div>
      </header>

      <section className={styles.hero}>
        {data.hero_url ? (
          <div className={styles.heroVisual}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.hero_url} alt="Site aerial" />
          </div>
        ) : null}
        <span className={styles.kicker}>
          {tier1 ? "TIER-1 ARCHITECTURAL MASSING" : "PREPARED FOR YOU"}
        </span>
        <h1 className={styles.address}>{project.address}</h1>
        {tier1 && (
          <p className={styles.heroLede}>
            Architecture locked. Singular-species blocks, bluestone ground plane,
            concealed deck lighting. Saving {aud0(Math.abs(tier1.net_inc_gst))}{" "}
            vs cottage scatter scope.
          </p>
        )}
      </section>

      {survey && (
        <section className={styles.summary}>
          <Metric label="Lot" value={`${survey.lot_area_m2} m2`} />
          <Metric label="House" value={`${survey.house_area_m2} m2`} />
          <Metric label="Garden" value={`${survey.garden_area_m2} m2`} />
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

      {tier1 && (
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Value reallocation</h2>
          <div className={styles.ledger}>
            <div className={styles.ledgerCol}>
              <span className={styles.ledgerKicker}>Removed</span>
              <span className={styles.ledgerAmount}>
                {aud0(tier1.removed_ex)}
              </span>
              <p className={styles.ledgerNote}>
                Cottage perennials, ferns, organic mulch, redundant irrigation
                zone.
              </p>
            </div>
            <div className={styles.ledgerCol}>
              <span className={styles.ledgerKicker}>Deployed</span>
              <span className={styles.ledgerAmount}>
                {aud0(tier1.deployed_ex)}
              </span>
              <p className={styles.ledgerNote}>
                Cycas anchors, Buxus structure, Mondo grid, bluestone screenings,
                deck strip lighting.
              </p>
            </div>
          </div>
        </section>
      )}

      {allCostings.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Investment</h2>

          <div
            className={styles.scenarioRow}
            role="tablist"
            aria-label="Price scenarios"
          >
            {SCENARIOS.map((s) => {
              const c = allCostings.find((x) => x.scenario === s.id);
              if (!c) return null;
              const selected = scenario === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`${styles.scenarioCard} ${selected ? styles.scenarioCardActive : ""}`}
                  onClick={() => setScenario(s.id)}
                >
                  <span className={styles.scenarioLabel}>{s.label}</span>
                  <span className={styles.scenarioTotal}>{aud0(c.total)}</span>
                  <span className={styles.scenarioNote}>{s.note}</span>
                </button>
              );
            })}
          </div>

          {active && (
            <>
              <div className={styles.total}>
                <span className={styles.totalKicker}>
                  {active.scenario.toUpperCase()} - TOTAL INCL. GST
                </span>
                <span className={styles.totalAmount}>{aud0(active.total)}</span>
                <span className={styles.totalSub}>
                  Subtotal {aud2(active.subtotal)} - GST {aud2(active.gst)}
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
                  {active.line_items
                    .filter((li) => !li.is_provisional)
                    .map((li, i) => (
                      <tr key={`${li.label}-${i}`}>
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
            </>
          )}

          <p className={styles.transparency}>
            Every line links to the live rate card. Substitution levers are
            disclosed - nothing silent.
          </p>
        </section>
      )}

      <section className={styles.acceptSection}>
        {active && data.deposit_url ? (
          <Link href={data.deposit_url} className={styles.acceptButton}>
            Accept &amp; pay {aud2(active.total * 0.2)} deposit
          </Link>
        ) : (
          <span className={styles.acceptButtonDisabled}>
            Deposit checkout pending
          </span>
        )}
        <p className={styles.acceptNote}>
          {active
            ? "A 20% deposit secures your project on the Standard scenario. Balance billed in stages as works progress."
            : "Deposit checkout unlocks once Curtis & Co issues the costed quote."}
        </p>
      </section>

      <footer className={styles.colophon}>
        <span>Curtis &amp; Co - {project.address}</span>
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
