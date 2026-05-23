import Link from "next/link";
import { requireProject } from "../../../../lib/project-guard";
import {
  listCostings,
  type CostScenario,
} from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import p from "../project.module.css";
import { runCostingAction } from "../../../actions";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";
import { PipelineActionForm } from "../../../../components/PipelineActionForm";

export const dynamic = "force-dynamic";

const SCENARIOS: CostScenario[] = ["lean", "standard", "buffer"];
const SCENARIO_DESCRIPTIONS: Record<CostScenario, string> = {
  lean: "Tightest competitive price. Conservative on contingency, standard plant stock.",
  standard: "Curtis & Co's recommended scope and stock. The default quote.",
  buffer: "Premium stock and upgraded specifications. Pleached screens go to advanced grades.",
};

export default async function CostingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const project = await requireProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const costings = await listCostings(id);

  const activeScenario: CostScenario =
    sp.scenario && SCENARIOS.includes(sp.scenario as CostScenario)
      ? (sp.scenario as CostScenario)
      : "standard";
  const active =
    costings.find((c) => c.scenario === activeScenario) ?? costings[0];

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

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="costing" />

      <h1 className={s.headline}>Costing</h1>
      <p className={s.lede}>
        Three scenarios priced off the live rate card. POA items surfaced
        separately — never silent in the total.
      </p>

      <div className={s.actionBar}>
        <PipelineActionForm
          projectId={id}
          action={runCostingAction}
          label={costings.length > 0 ? "Re-price" : "Price it"}
          pendingLabel="Pricing…"
          successMessage="Costing complete"
        />
      </div>

      {costings.length === 0 ? (
        <div className={s.empty}>
          No costing yet. Generate the design first, then click{" "}
          <strong>Price it</strong>.
        </div>
      ) : (
        <>
          <div className={p.scenarioTabs}>
            {SCENARIOS.map((sc) => {
              const found = costings.find((c) => c.scenario === sc);
              return (
                <Link
                  key={sc}
                  href={`/projects/${id}/costing?scenario=${sc}`}
                  className={`${p.scenarioTab} ${activeScenario === sc ? p.scenarioTabActive : ""}`}
                >
                  {sc[0].toUpperCase() + sc.slice(1)}
                  {found ? ` · ${aud0(found.total)}` : ""}
                </Link>
              );
            })}
          </div>

          {active && (
            <>
              <div className={p.totalCard}>
                <span className={p.totalKicker}>
                  {active.scenario.toUpperCase()} · TOTAL INCL. GST
                </span>
                <span className={p.totalAmount}>{aud0(active.total)}</span>
                <span className={p.totalSub}>
                  Subtotal {aud2(active.subtotal)} · GST {aud2(active.gst)}
                </span>
              </div>

              <p className={s.lede}>{SCENARIO_DESCRIPTIONS[active.scenario]}</p>

              <h2 className={s.sectionHeading}>
                Line items ({active.line_items.length})
              </h2>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Item</th>
                    <th className={s.alignRight}>Qty</th>
                    <th className={s.alignRight}>Rate</th>
                    <th className={s.alignRight}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {active.line_items.map((li, i) => (
                    <tr key={i}>
                      <td className={s.mono}>{li.sku}</td>
                      <td>
                        {li.label}
                        {li.is_provisional && (
                          <>
                            {" "}
                            <span className={`${s.pill} ${s.pillWarn}`}>
                              POA
                            </span>
                          </>
                        )}
                        {li.notes && <div className={p.lineNotes}>{li.notes}</div>}
                      </td>
                      <td className={`${s.alignRight} ${s.mono}`}>
                        {li.qty} {li.unit}
                      </td>
                      <td className={`${s.alignRight} ${s.mono}`}>
                        {aud2(li.rate)}
                      </td>
                      <td className={`${s.alignRight} ${s.mono} ${s.strong}`}>
                        {li.is_provisional ? "—" : aud0(li.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </main>
  );
}
