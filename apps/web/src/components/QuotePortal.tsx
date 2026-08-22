"use client";

import { useMemo, useRef, useState } from "react";
import { Tier1SavingsLedger } from "./tier1";
import { KitButton } from "./ui/kit";
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
  /** Non-costed written assumptions — machine access, derived-level provenance. */
  assumptions?: string[];
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
    note: "Recommended scope — architectural massing as specified.",
  },
  {
    id: "buffer",
    label: "Buffer",
    note: "Premium stock + 6% scope contingency on top of margin.",
  },
] as const;

function scenarioDomId(prefix: string, id: string): string {
  return `${prefix}-${encodeURIComponent(id)}`;
}

function scenarioLabel(id: string): string {
  return (
    SCENARIOS.find((item) => item.id === id)?.label ??
    id.replace(/(^|-)([a-z])/g, (_match, prefix: string, letter: string) =>
      `${prefix ? " " : ""}${letter.toUpperCase()}`,
    )
  );
}

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
  const scenarioTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const active =
    allCostings.find((c) => c.scenario === scenario) ??
    allCostings.find((c) => c.scenario === "standard") ??
    allCostings[0] ??
    null;
  const knownScenarios = SCENARIOS.filter((candidate) =>
    allCostings.some((costing) => costing.scenario === candidate.id),
  );
  const customScenarios = allCostings
    .filter((costing) => !SCENARIOS.some((candidate) => candidate.id === costing.scenario))
    .map((costing) => ({
      id: costing.scenario,
      label: scenarioLabel(costing.scenario),
      note: "Custom pricing scenario.",
    }));
  const availableScenarios = [
    ...knownScenarios,
    ...customScenarios.filter(
      (candidate, index, list) =>
        list.findIndex((item) => item.id === candidate.id) === index,
    ),
  ];
  const activeScenarioId = active?.scenario ?? availableScenarios[0]?.id ?? null;
  const activeScenarioIndex = activeScenarioId
    ? availableScenarios.findIndex((candidate) => candidate.id === activeScenarioId)
    : -1;
  const activeScenarioLabel = active ? scenarioLabel(active.scenario) : "selected";

  function focusScenario(id: string) {
    setScenario(id);
    window.requestAnimationFrame(() => scenarioTabRefs.current[id]?.focus());
  }

  function moveScenarioBy(step: number) {
    if (availableScenarios.length < 2 || activeScenarioIndex < 0) return;
    const next =
      (activeScenarioIndex + step + availableScenarios.length) %
      availableScenarios.length;
    focusScenario(availableScenarios[next]!.id);
  }

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
              <img src={data.hero_url} alt="Site aerial" />
            </div>
          ) : null}
          <span className={styles.kicker}>
            {tier1 ? "Architectural massing" : "Prepared for your garden"}
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
              label="Existing dwelling"
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
              {availableScenarios.map((s) => {
                const c = allCostings.find((x) => x.scenario === s.id);
                if (!c) return null;
                const selected = activeScenarioId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    ref={(node) => {
                      scenarioTabRefs.current[s.id] = node;
                    }}
                    id={scenarioDomId("quote-scenario-tab", s.id)}
                    role="tab"
                    aria-selected={selected}
                    aria-controls={scenarioDomId("quote-scenario-panel", s.id)}
                    tabIndex={selected ? 0 : -1}
                    className={`${styles.scenarioCard} ${selected ? styles.scenarioCardActive : ""}`}
                    onClick={() => setScenario(s.id)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                        event.preventDefault();
                        moveScenarioBy(1);
                      } else if (
                        event.key === "ArrowLeft" ||
                        event.key === "ArrowUp"
                      ) {
                        event.preventDefault();
                        moveScenarioBy(-1);
                      } else if (event.key === "Home") {
                        event.preventDefault();
                        focusScenario(availableScenarios[0]!.id);
                      } else if (event.key === "End") {
                        event.preventDefault();
                        focusScenario(
                          availableScenarios[availableScenarios.length - 1]!.id,
                        );
                      }
                    }}
                  >
                    <span className={styles.scenarioLabel}>{s.label}</span>
                    <span className={styles.scenarioTotal}>{aud2(c.total)}</span>
                    <span className={styles.scenarioNote}>{s.note}</span>
                  </button>
                );
              })}
            </div>

            {active && (
              <div
                role="tabpanel"
                id={scenarioDomId("quote-scenario-panel", active.scenario)}
                aria-labelledby={scenarioDomId("quote-scenario-tab", active.scenario)}
                tabIndex={0}
              >
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

                {active.assumptions && active.assumptions.length > 0 ? (
                  <div className={styles.assumptions}>
                    <p className={styles.assumptionsKicker}>
                      Quote assumptions
                    </p>
                    <ul>
                      {active.assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

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
              </div>
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
              <KitButton
                as="a"
                href={
                  data.deposit_url
                    ? `${data.deposit_url}${data.deposit_url.includes("?") ? "&" : "?"}scenario=${encodeURIComponent(active.scenario)}`
                    : `/portal/deposit/${token}?scenario=${encodeURIComponent(active.scenario)}`
                }
                variant="accent"
                size="lg"
                data-testid="portal-deposit-cta"
                data-scenario={active.scenario}
              >
                Accept &amp; pay {aud2(active.total * 0.2)} deposit
              </KitButton>
              <p className={styles.acceptNote}>
                A 20% deposit secures your garden on the {activeScenarioLabel}{" "}
                scenario ({active.scenario}). Balance billed in stages as works
                progress.
              </p>
            </>
          ) : (
            <>
              <KitButton variant="secondary" size="lg" disabled>
                Deposit unavailable
              </KitButton>
              <p className={styles.acceptNote}>
                Workstream will issue the deposit link once the quote total
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
