import { getProject, getSurvey } from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import { runSurveyAction } from "../../../actions";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";
import { SubmitButton } from "../../../../components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return <NotFoundPage message="Project not found." />;
  }
  const survey = await getSurvey(id);

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="survey" />

      <h1 className={s.headline}>Survey</h1>
      <p className={s.lede}>
        Vicmap cadastre fetched for the address. Building footprint subtracted,
        garden polygon derived. Edge measurements rendered along every boundary.
      </p>

      <div className={s.actionBar}>
        <form action={runSurveyAction}>
          <input type="hidden" name="projectId" value={id} />
          <SubmitButton
            className={survey ? s.btnGhost : s.btn}
            pendingLabel="Running survey…"
          >
            {survey ? "Re-run survey" : "Run survey"}
          </SubmitButton>
        </form>
      </div>

      {!survey ? (
        <div className={s.empty}>
          Survey hasn&apos;t been run for this project yet. Click{" "}
          <strong>Run survey</strong> above — the API will geocode the address
          and pull the lot polygon from Vicmap (or use a mock if Mapbox is
          unconfigured).
        </div>
      ) : (
        <>
          <div className={s.grid3}>
            <div className={s.metric}>
              <span className={s.metricLabel}>Lot</span>
              <span className={s.metricValue}>
                {Math.round(survey.lot_area_m2)}
                <span className={s.metricUnit}> m²</span>
              </span>
            </div>
            <div className={s.metric}>
              <span className={s.metricLabel}>House footprint</span>
              <span className={s.metricValue}>
                {Math.round(survey.house_area_m2)}
                <span className={s.metricUnit}> m²</span>
              </span>
            </div>
            <div className={s.metric}>
              <span className={s.metricLabel}>Garden</span>
              <span className={s.metricValue}>
                {Math.round(survey.garden_area_m2)}
                <span className={s.metricUnit}> m²</span>
              </span>
            </div>
          </div>

          <h2 className={s.sectionHeading}>
            Boundary measurements ({survey.measurements.length})
          </h2>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Edge</th>
                <th>Label</th>
                <th className={s.alignRight}>Length</th>
                <th className={s.alignRight}>Bearing</th>
              </tr>
            </thead>
            <tbody>
              {survey.measurements.map((m) => (
                <tr key={m.edge_id}>
                  <td className={s.mono}>{m.edge_id}</td>
                  <td>{m.label ?? "—"}</td>
                  <td className={`${s.alignRight} ${s.mono}`}>
                    {m.length_m.toFixed(2)} m
                  </td>
                  <td className={`${s.alignRight} ${s.mono}`}>
                    {m.bearing_deg.toFixed(0)}°
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
