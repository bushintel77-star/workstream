import { listCrew } from "../../../lib/api";
import s from "../../../styles/app.module.css";
import { createCrewAction } from "../../actions";
import { SettingsMasthead } from "../SettingsShell";
import c from "./crew.module.css";
import { SubmitButton } from "../../../components/SubmitButton";
import { CrewRemoveButton } from "../../../components/CrewRemoveButton";

export const dynamic = "force-dynamic";

export default async function CrewPage() {
  let crew: Awaited<ReturnType<typeof listCrew>> = [];
  let loadError: string | null = null;
  try {
    crew = await listCrew();
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
    <main className={s.pageNarrow}>
      <SettingsMasthead active="crew" subtitle="Crew" />

      <h1 className={s.headline}>Crew</h1>
      <p className={s.lede}>
        Tradies and subcontractors available to assign to tasks. Hourly rate
        used by the costing engine when build labour is priced.
      </p>

      <form action={createCrewAction} className={c.newForm}>
        <input
          className={s.input}
          name="name"
          type="text"
          placeholder="Name"
          required
        />
        <select
          className={s.select}
          name="role"
          defaultValue="tradesperson"
          aria-label="Crew role"
        >
          <option value="lead">Lead</option>
          <option value="senior">Senior</option>
          <option value="tradesperson">Tradesperson</option>
          <option value="apprentice">Apprentice</option>
          <option value="labourer">Labourer</option>
          <option value="subcontractor">Subcontractor</option>
        </select>
        <input
          className={s.input}
          name="phone"
          type="tel"
          placeholder="Phone"
        />
        <input
          className={s.input}
          name="hourly_rate"
          type="number"
          step="0.01"
          min="0"
          placeholder="$/hr"
        />
        <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
      </form>

      {loadError && (
        <div className={s.error}>Couldn&apos;t load crew: {loadError}</div>
      )}

      {crew.length === 0 && !loadError ? (
        <div className={s.empty}>No crew members yet.</div>
      ) : (
        <ul className={s.list}>
          {crew.map((m) => (
            <li key={m.id} className={c.row}>
              <div className={c.rowMain}>
                <span className={c.name}>{m.name}</span>
                <span className={c.meta}>
                  <span className={`${s.pill} ${s.pillMuted}`}>{m.role}</span>
                  {m.phone && <span className={s.mono}>{m.phone}</span>}
                  <span className={s.mono}>{aud2(m.hourly_rate)}/hr</span>
                  {!m.active && (
                    <span className={`${s.pill} ${s.pillBlock}`}>Inactive</span>
                  )}
                </span>
              </div>
              <CrewRemoveButton id={m.id} name={m.name} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
