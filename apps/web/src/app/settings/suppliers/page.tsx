import { listSuppliers } from "../../../lib/api";
import s from "../../../styles/app.module.css";
import { SettingsMasthead } from "../SettingsShell";

export const dynamic = "force-dynamic";

const SUPPLIER_LABELS: Record<string, string> = {
  bunnings: "Bunnings",
  boral: "Boral",
  holcim: "Holcim",
  andersons: "Andersons",
  anl: "ANL",
  online_plants_au: "Online Plants AU",
  speciality_trees: "Speciality Trees",
};

export default async function SuppliersPage() {
  let suppliers: Awaited<ReturnType<typeof listSuppliers>> = [];
  let loadError: string | null = null;
  try {
    suppliers = await listSuppliers();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not reach the API.";
  }

  const aud2 = (n: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(n);

  return (
    <main className={s.page}>
      <SettingsMasthead active="suppliers" subtitle="Suppliers" />

      <h1 className={s.headline}>Suppliers</h1>
      <p className={s.lede}>
        Live price snapshots from each supplier. The costing engine uses these
        to keep rate-card defaults honest — discrepancies surface as audit
        findings.
      </p>

      {loadError && (
        <div className={s.error}>Couldn&apos;t load suppliers: {loadError}</div>
      )}

      {!loadError && suppliers.length === 0 && (
        <div className={s.empty}>No supplier feeds configured.</div>
      )}

      {suppliers.map((sup) => (
        <section key={sup.supplier}>
          <h2 className={s.sectionHeading}>
            {SUPPLIER_LABELS[sup.supplier] ?? sup.supplier} ·{" "}
            <span className={s.dim}>
              fetched {new Date(sup.fetched_at).toLocaleString("en-AU")}
            </span>
          </h2>
          <table className={s.table}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th>Unit</th>
                <th className={s.alignRight}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {sup.prices.map((pr, i) => (
                <tr key={`${pr.sku}-${i}`}>
                  <td className={s.mono}>{pr.sku}</td>
                  <td>{pr.label}</td>
                  <td className={s.mono}>{pr.unit}</td>
                  <td className={`${s.alignRight} ${s.mono}`}>
                    {aud2(pr.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  );
}
