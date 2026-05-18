import { getAudit, getProject } from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import p from "../project.module.css";
import { runAuditAction } from "../../../actions";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";
import { SubmitButton } from "../../../../components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const audit = await getAudit(id);

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="audit" />

      <h1 className={s.headline}>Audit</h1>
      <p className={s.lede}>
        A second Claude pass interrogates the design and costing for fidelity,
        safety, scope and cost. Blocking findings stop outputs from being
        generated until an override is recorded.
      </p>

      <div className={s.actionBar}>
        <form action={runAuditAction}>
          <input type="hidden" name="projectId" value={id} />
          <SubmitButton
            className={audit ? s.btnGhost : s.btn}
            pendingLabel="Auditing…"
          >
            {audit ? "Re-run audit" : "Run audit"}
          </SubmitButton>
        </form>
        {audit && (
          <span
            className={`${s.pill} ${audit.passed ? s.pillOk : s.pillBlock}`}
          >
            {audit.passed ? "Passed" : "Blocked"}
          </span>
        )}
      </div>

      {!audit ? (
        <div className={s.empty}>
          No audit yet. Generate the costing first, then run the audit.
        </div>
      ) : (
        <>
          <div className={s.grid2}>
            <div className={s.metric}>
              <span className={s.metricLabel}>Blocking</span>
              <span className={s.metricValue}>{audit.blocking_count}</span>
            </div>
            <div className={s.metric}>
              <span className={s.metricLabel}>Advisory</span>
              <span className={s.metricValue}>{audit.advisory_count}</span>
            </div>
          </div>

          {audit.findings.length === 0 ? (
            <div className={s.empty}>
              No findings — the design and costing pass cleanly.
            </div>
          ) : (
            <>
              <h2 className={s.sectionHeading}>
                Findings ({audit.findings.length})
              </h2>
              {audit.findings.map((f, i) => (
                <div
                  key={i}
                  className={`${p.finding} ${f.severity === "blocking" ? p.findingBlocking : p.findingAdvisory}`}
                >
                  <div className={p.findingHead}>
                    <span className={p.findingLocation}>
                      {f.category} · {f.location}
                    </span>
                    <span
                      className={`${s.pill} ${f.severity === "blocking" ? s.pillBlock : s.pillWarn}`}
                    >
                      {f.severity}
                    </span>
                  </div>
                  <p className={p.findingStatement}>{f.statement}</p>
                  <p className={p.findingAction}>
                    <strong>Suggested:</strong> {f.suggested_action}
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
