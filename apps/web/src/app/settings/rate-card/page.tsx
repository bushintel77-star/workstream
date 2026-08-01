import { listRateCard } from "../../../lib/api";
import s from "../../../styles/app.module.css";
import { updateRateAction } from "../../actions";
import { SettingsMasthead } from "../SettingsShell";
import { SubmitButton } from "../../../components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function RateCardPage() {
  let items: Awaited<ReturnType<typeof listRateCard>> = [];
  let loadError: string | null = null;
  try {
    items = await listRateCard();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not reach the API.";
  }

  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const arr = grouped.get(item.category) ?? [];
    arr.push(item);
    grouped.set(item.category, arr);
  }
  const categories = Array.from(grouped.keys()).sort();

  const aud2 = (n: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(n);

  return (
    <main className={s.page}>
      <SettingsMasthead active="rate-card" subtitle="Rate card" />

      <h1 className={s.headline}>Rate card</h1>
      <p className={s.lede}>
        Live unit rates used by the costing engine. Edit any rate — every
        future quote re-prices off the updated value.
      </p>

      {loadError && (
        <div className={s.error}>Couldn&apos;t load rate card: {loadError}</div>
      )}

      {!loadError && items.length === 0 && (
        <div className={s.empty}>
          No rate card seeded yet. The API seeds defaults on first run.
        </div>
      )}

      {categories.map((cat) => {
        const rows = grouped.get(cat) ?? [];
        return (
          <section key={cat}>
            <h2 className={s.sectionHeading}>{cat}</h2>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Item</th>
                  <th>Unit</th>
                  <th className={s.alignRight}>Current rate</th>
                  <th className={s.alignRight}>Update</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={s.mono}>{r.sku}</td>
                    <td>
                      <span className={s.strong}>{r.label}</span>
                      {r.supplier && (
                        <div className={s.dim}>via {r.supplier}</div>
                      )}
                    </td>
                    <td className={s.mono}>{r.unit}</td>
                    <td className={`${s.alignRight} ${s.mono}`}>
                      {aud2(r.rate)}
                    </td>
                    <td className={s.alignRight}>
                      <form action={updateRateAction}>
                        <input type="hidden" name="sku" value={r.sku} />
                        <input
                          name="rate"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={r.rate}
                          className={`${s.input} ${s.mono}`}
                          aria-label={`Rate for ${r.label}`}
                        />
                        <SubmitButton
                          variant="ghost"
                          pendingLabel="Saving…"
                          aria-label="Save"
                        >
                          Save
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
