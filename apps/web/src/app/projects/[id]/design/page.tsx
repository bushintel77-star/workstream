import { getDesign, getProject, getSurvey } from "../../../../lib/api";
import { isTier1WrightsTerrace } from "@workstream/domain";
import { DesignProposalView } from "../../../../components/DesignZones";
import s from "../../../../styles/app.module.css";
import { runDesignAction } from "../../../actions";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";
import { SubmitButton } from "../../../../components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const [survey, design] = await Promise.all([getSurvey(id), getDesign(id)]);
  const tier1 = isTier1WrightsTerrace(project.address);

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="design" />

      <h1 className={s.headline}>Design</h1>
      <p className={s.lede}>
        Architectural massing in Curtis &amp; Co vocabulary — singular species,
        disciplined blocks, hardscape and lighting considered together.
      </p>

      <div className={s.actionBar}>
        {!survey ? (
          <button type="button" className={s.btn} disabled>
            Run survey first
          </button>
        ) : (
          <form action={runDesignAction}>
            <input type="hidden" name="projectId" value={id} />
            <SubmitButton
              className={design ? s.btnGhost : s.btn}
              pendingLabel="Designing…"
            >
              {design ? "Regenerate design" : "Generate design"}
            </SubmitButton>
          </form>
        )}
        {design && (
          <span className={`${s.pill} ${s.pillInfo}`}>
            v{design.version} · {design.mode}
          </span>
        )}
        {design && tier1 && (
          <span className={`${s.pill} ${s.pillAccent}`}>Tier-1</span>
        )}
        {design && (
          <span className={`${s.pill} ${s.pillMuted}`}>
            {design.proposal.estimated_complexity}
          </span>
        )}
      </div>

      {!design ? (
        <div className={s.empty}>
          No design yet. Run the survey first, then generate a design.
        </div>
      ) : (
        <DesignProposalView
          design={design}
          aerialUri={survey?.aerial_uri ?? null}
          tier1={tier1}
        />
      )}
    </main>
  );
}
