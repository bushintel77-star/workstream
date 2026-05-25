import type { Survey } from "../lib/api";
import s from "../styles/app.module.css";
import { PipelineImageShell } from "./PipelineImageShell";
import sh from "./pipelineImageShell.module.css";
import { PipelineAerialHero } from "./PipelineAerialHero";
import { SitePlanFigure } from "./SitePlanFigure";
import { PipelineActionForm } from "./PipelineActionForm";

type Props = {
  projectId: string;
  survey: Survey;
  runSurveyAction: (fd: FormData) => Promise<void>;
};

/** Survey results in the shared image-shell framework. */
export function PipelineSurveyView({ projectId, survey, runSurveyAction }: Props) {
  const rail = (
    <div className={sh.railScroll}>
      <p className={s.lede}>
        Satellite lot plan with boundary dimensions. Lot polygon from Vicmap when enabled,
        otherwise a rectangular mock for the pinned coordinates.
      </p>

      <div className={s.actionBar}>
        <PipelineActionForm
          projectId={projectId}
          action={runSurveyAction}
          label="Re-run survey"
          pendingLabel="Running survey…"
          successMessage="Survey complete"
        />
      </div>

      <SitePlanFigure survey={survey} caption="Site plan · lot & building" />

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
    </div>
  );

  return (
    <PipelineImageShell
      testId="pipeline-survey-image-shell"
      canvasCol={
        <PipelineAerialHero
          survey={survey}
          projectId={projectId}
          badge="Lot surveyed"
          honestyCaption="Survey lot geometry — open studio to sketch"
        />
      }
      rail={rail}
    />
  );
}
