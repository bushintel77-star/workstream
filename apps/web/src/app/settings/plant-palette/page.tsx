import { listPlantPalette } from "../../../lib/api";
import s from "../../../styles/app.module.css";
import { SettingsMasthead } from "../SettingsShell";

export const dynamic = "force-dynamic";

export default async function PlantPaletteSettingsPage() {
  let items: Awaited<ReturnType<typeof listPlantPalette>> = [];
  let loadError: string | null = null;
  try {
    items = await listPlantPalette();
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

  return (
    <main className={s.page}>
      <SettingsMasthead active="plant-palette" subtitle="Plant palette" />

      <h1 className={s.headline}>Plant palette</h1>
      <p className={s.lede}>
        Curtis &amp; Co&apos;s house list. Claude can only propose species from
        this palette — anything off-palette is rejected at the gate. Maintained
        here in the API; field edits via the operator app are coming.
      </p>

      {loadError && (
        <div className={s.error}>
          Couldn&apos;t load plant palette: {loadError}
        </div>
      )}

      {!loadError && items.length === 0 && (
        <div className={s.empty}>No species seeded yet.</div>
      )}

      {categories.map((cat) => {
        const rows = grouped.get(cat) ?? [];
        return (
          <section key={cat}>
            <h2 className={s.sectionHeading}>
              {cat} ({rows.length})
            </h2>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Species</th>
                  <th>Common</th>
                  <th>Form</th>
                  <th className={s.alignRight}>Mature H × W</th>
                  <th>Use</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((pl) => (
                  <tr key={pl.id}>
                    <td>
                      <em className={s.mono}>{pl.species}</em>
                    </td>
                    <td className={s.strong}>{pl.common_name}</td>
                    <td className={s.dim}>{pl.form ?? "—"}</td>
                    <td className={`${s.alignRight} ${s.mono}`}>
                      {pl.mature_h_m} × {pl.mature_w_m} m
                    </td>
                    <td className={s.dim}>{pl.use_description}</td>
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
