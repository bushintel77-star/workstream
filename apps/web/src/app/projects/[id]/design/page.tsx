import { getDesign, getProject, getSurvey } from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import p from "../project.module.css";
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

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="design" />

      <h1 className={s.headline}>Design</h1>
      <p className={s.lede}>
        Claude drafts the proposal in Curtis &amp; Co&apos;s vocabulary —
        pleached screens, mass-planted understorey, bluestone hardscape.
        Off-palette species are rejected before they reach you.
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
            Version {design.version} · {design.mode}
          </span>
        )}
        {design && (
          <span className={`${s.pill} ${s.pillAccent}`}>
            {design.proposal.estimated_complexity}
          </span>
        )}
      </div>

      {!design ? (
        <div className={s.empty}>
          No design yet. Run the survey first, then generate a design.
        </div>
      ) : (
        <>
          <div className={s.card}>
            <h3 className={s.cardTitle}>Rationale</h3>
            <p className={p.rationale}>{design.rationale}</p>
          </div>

          <h2 className={s.sectionHeading}>
            Zones ({design.proposal.zones.length})
          </h2>
          {design.proposal.zones.map((z) => (
            <div key={z.id} className={p.zone}>
              <h3 className={p.zoneName}>{z.name}</h3>
              <p className={p.zoneTreatment}>{z.treatment}</p>

              {z.plantings.length > 0 && (
                <>
                  <div className={p.zoneSubhead}>Plantings</div>
                  <ul className={p.zoneItems}>
                    {z.plantings.map((pl, i) => (
                      <li key={i}>
                        <strong>{pl.count}×</strong> {pl.common_name}{" "}
                        <em className={p.species}>{pl.species}</em> — {pl.form}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {z.hardscape.length > 0 && (
                <>
                  <div className={p.zoneSubhead}>Hardscape</div>
                  <ul className={p.zoneItems}>
                    {z.hardscape.map((h, i) => (
                      <li key={i}>
                        {h.item} — {h.qty} {h.unit}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {z.lighting.length > 0 && (
                <>
                  <div className={p.zoneSubhead}>Lighting</div>
                  <ul className={p.zoneItems}>
                    {z.lighting.map((l, i) => (
                      <li key={i}>
                        {l.count}× {l.fixture}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {z.irrigation.length > 0 && (
                <>
                  <div className={p.zoneSubhead}>Irrigation</div>
                  <ul className={p.zoneItems}>
                    {z.irrigation.map((ir, i) => (
                      <li key={i}>
                        {ir.item} — {ir.qty} {ir.unit}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}

          {design.gaps.length > 0 && (
            <>
              <h2 className={s.sectionHeading}>Gap flags</h2>
              {design.gaps.map((g, i) => (
                <div key={i} className={`${p.finding} ${p.findingAdvisory}`}>
                  <div className={p.findingHead}>
                    <span className={p.findingLocation}>{g.zone}</span>
                    <span className={`${s.pill} ${s.pillWarn}`}>Gap</span>
                  </div>
                  <p className={p.findingStatement}>{g.description}</p>
                  <p className={p.findingAction}>
                    Proposed: {g.proposed_fill} — {g.rationale}
                  </p>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </main>
  );
}
