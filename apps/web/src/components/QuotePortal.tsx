"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Tier1SavingsLedger } from "./tier1";
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

const aud2 = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(n);

export function QuotePortal({
  data,
  token,
}: {
  data: PortalQuoteData;
  token: string;
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
  const activeScenarioLabel =
    SCENARIOS.find((item) => item.id === active?.scenario)?.label ??
    active?.scenario.replace(/(^|-)([a-z])/g, (_match, prefix: string, letter: string) =>
      `${prefix ? " " : ""}${letter.toUpperCase()}`,
    ) ??
    "selected";

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
            Landscape design · Melbourne
          </span>
        </div>
        <div className={styles.docMeta}>
          <strong>Garden quote</strong>
          {generated}
        </div>
      </header>

      <div className={styles.sheet}>
        <section className={styles.hero}>
          {data.hero_url ? (
            <div className={styles.heroVisual}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.hero_url} alt="Site aerial" />
            </div>
          ) : null}
          <span className={styles.kicker}>
            {tier1 ? "Tier-1 architectural massing" : "Prepared for your garden"}
          </span>
          <h1 className={styles.address}>{project.address}</h1>
          {tier1 && (
            <p className={styles.heroLede}>
              Architecture locked. Singular-species blocks, bluestone ground
              plane, concealed deck lighting. Saving{" "}
              {aud2(Math.abs(tier1.net_inc_gst))} vs cottage scatter scope.
            </p>
          )}
        </section>

        {survey && (
          <section className={styles.summary}>
            <Metric label="Lot" value={`${survey.lot_area_m2} m²`} />
            <Metric
              label="Existing house"
              value={
                survey.house_area_m2 > 0
                  ? `${survey.house_area_m2} m²`
                  : "Not available"
              }
            />
            <Metric label="Garden" value={`${survey.garden_area_m2} m²`} />
          </section>
        )}

        {design && (
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>The planting story</h2>
            <p className={styles.rationale}>{design.rationale}</p>
            {design.proposal.zones.map((z) => (
              <div key={z.id} className={styles.zone}>
                <h3 className={styles.zoneName}>{z.name}</h3>
                <p className={styles.zoneTreatment}>{z.treatment}</p>
              </div>
            ))}
          </section>
        )}

        {tier1 ? (
          <section className={styles.section}>
            <Tier1SavingsLedger savings={tier1} showTarget={false} />
          </section>
        ) : null}

        {allCostings.length > 0 && (
          <section
            className={`${styles.section} ${styles.quoteWatermark}`}
            data-watermark={`CONFIDENTIAL · ${project.id}`}
            aria-label={`Confidential quote for project ${project.id}`}
          >
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
                    <span className={styles.scenarioTotal}>{aud2(c.total)}</span>
                    <span className={styles.scenarioNote}>{s.note}</span>
                  </button>
                );
              })}
            </div>

            {active && (
              <>
                <div className={styles.total}>
                  <span className={styles.totalKicker}>
                    {active.scenario} · total incl. GST
                  </span>
                  <span className={styles.totalAmount}>
                    {aud2(active.total)}
                  </span>
                  <span className={styles.totalSub}>
                    Subtotal {aud2(active.subtotal)} · GST {aud2(active.gst)}
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
                          <td className={styles.alignRight}>{aud2(li.total)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </>
            )}

            <p className={styles.transparency}>
              Every line links to the live rate card. Substitution levers are
              disclosed — nothing silent.
            </p>
          </section>
        )}

        <section className={styles.acceptSection}>
          {active ? (
            <>
              <Link
                href={`/portal/deposit/${token}`}
                className={styles.acceptButton}
              >
                Accept &amp; pay {aud2(active.total * 0.2)} deposit
              </Link>
              <p className={styles.acceptNote}>
                A 20% deposit secures your garden on the {activeScenarioLabel} scenario.
                Balance billed in stages as works progress.
              </p>
            </>
          ) : (
            <>
              <span className={styles.acceptButtonDisabled}>
                Deposit unavailable
              </span>
              <p className={styles.acceptNote}>
                Curtis &amp; Co will issue the deposit link once the quote total
                is confirmed.
              </p>
            </>
          )}
        </section>
      </div>

      <footer className={styles.colophon}>
        <span>Curtis &amp; Co · {project.address}</span>
        <span>Valid 30 days</span>
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
