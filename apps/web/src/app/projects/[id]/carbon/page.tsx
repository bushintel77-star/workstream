import { getCarbon, getProject } from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";

export const dynamic = "force-dynamic";

export default async function CarbonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const carbon = await getCarbon(id);

  const fmtKg = (n: number) =>
    new Intl.NumberFormat("en-AU", {
      maximumFractionDigits: 0,
    }).format(n);

  const totalsByCategory = carbon
    ? Object.entries(carbon.by_category).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="carbon" />

      <h1 className={s.headline}>Embodied carbon</h1>
      <p className={s.lede}>
        Estimate of CO₂e locked into the build — concrete, steel, imported
        stock, transport. Calculated off the Standard costing line items
        against domain-side emissions factors.
      </p>

      {!carbon ? (
        <div className={s.empty}>
          No carbon estimate yet — costing is required before this can be
          calculated.
        </div>
      ) : (
        <>
          <div className={s.card}>
            <span className={s.metricLabel}>Total · {carbon.scenario}</span>
            <span className={s.metricValue}>
              {fmtKg(carbon.total_kg_co2e)}
              <span className={s.metricUnit}> kg CO₂e</span>
            </span>
          </div>

          {totalsByCategory.length > 0 && (
            <>
              <h2 className={s.sectionHeading}>By category</h2>
              <div className={s.grid2}>
                {totalsByCategory.map(([cat, kg]) => (
                  <div key={cat} className={s.metric}>
                    <span className={s.metricLabel}>{cat}</span>
                    <span className={s.metricValue}>
                      {fmtKg(kg)}
                      <span className={s.metricUnit}> kg</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className={s.sectionHeading}>
            Line breakdown ({carbon.lines.length})
          </h2>
          <table className={s.table}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th className={s.alignRight}>Qty</th>
                <th className={s.alignRight}>Factor</th>
                <th className={s.alignRight}>Total kg CO₂e</th>
              </tr>
            </thead>
            <tbody>
              {carbon.lines.map((l, i) => (
                <tr key={i}>
                  <td className={s.mono}>{l.sku}</td>
                  <td>{l.label}</td>
                  <td className={`${s.alignRight} ${s.mono}`}>
                    {l.qty} {l.unit}
                  </td>
                  <td className={`${s.alignRight} ${s.mono}`}>
                    {l.factor_kg_co2e.toFixed(2)}
                  </td>
                  <td className={`${s.alignRight} ${s.mono} ${s.strong}`}>
                    {fmtKg(l.total_kg_co2e)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
