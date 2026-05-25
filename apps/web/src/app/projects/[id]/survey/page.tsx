import { requireProject } from "../../../../lib/project-guard";
import { getSurvey } from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import { runSurveyAction } from "../../../actions";
import { NotFoundPage } from "../ProjectShell";
import {
  PipelineContent,
  ProjectPipelineShell,
} from "../../../../components/ProjectPipelineShell";
import { PipelineActionForm } from "../../../../components/PipelineActionForm";
import { PipelineSurveyView } from "../../../../components/PipelineSurveyView";

export const dynamic = "force-dynamic";

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) {
    return <NotFoundPage message="Project not found." />;
  }
  const survey = await getSurvey(id);

  return (
    <ProjectPipelineShell
      project={project}
      active="survey"
      variant={survey ? "immersive" : "content"}
    >
      {survey ? (
        <PipelineSurveyView
          projectId={id}
          survey={survey}
          runSurveyAction={runSurveyAction}
        />
      ) : (
        <PipelineContent>
          <p className={s.lede}>
            Satellite lot plan with boundary dimensions. Lot polygon from Vicmap when
            enabled, otherwise a rectangular mock for the pinned coordinates.
          </p>
          <div className={s.actionBar}>
            <PipelineActionForm
              projectId={id}
              action={runSurveyAction}
              label="Run survey"
              pendingLabel="Running survey…"
              successMessage="Survey complete"
            />
          </div>
          <div className={s.empty}>
            Survey hasn&apos;t been run for this project yet. Confirm the address on the
            aerial when creating the project, or click <strong>Run survey</strong> above.
          </div>
        </PipelineContent>
      )}
    </ProjectPipelineShell>
  );
}
