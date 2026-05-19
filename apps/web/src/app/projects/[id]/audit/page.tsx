import { getAudit, getProject, listOverrides } from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import p from "../project.module.css";
import { createOverrideAction, runAuditAction } from "../../../actions";
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

  const [audit, overrides] = await Promise.all([
    getAudit(id),
    listOverrides(id),
  ]);
  const overrideByIndex = new Map(overrides.map((o) => [o.finding_index, o]));

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="audit" />

      <h1 className={s.headline}>Audit</h1>
      <p className={s.lede}>
        A second Claude pass interrogates the design and costing for fidelity,
        safety, scope and cost. Blocking findings stop outputs until either the
        design is fixed or each finding is explicitly overridden — overrides
        are recorded forever in the project ledger.
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
              {audit.findings.map((f, i) => {
                const override = overrideByIndex.get(i);
                const isBlocking = f.severity === "blocking";
                return (
                  <div
                    key={i}
                    className={`${p.finding} ${isBlocking ? p.findingBlocking : p.findingAdvisory}`}
                  >
                    <div className={p.findingHead}>
                      <span className={p.findingLocation}>
                        {f.category} · {f.location}
                      </span>
                      <span
                        className={`${s.pill} ${isBlocking ? s.pillBlock : s.pillWarn}`}
                      >
                        {f.severity}
                      </span>
                    </div>
                    <p className={p.findingStatement}>{f.statement}</p>
                    <p className={p.findingAction}>
                      <strong>Suggested:</strong> {f.suggested_action}
                    </p>

                    {override ? (
                      <div className={p.overrideRecorded}>
                        <span className={`${s.pill} ${s.pillOk}`}>
                          Overridden
                        </span>{" "}
                        <span className={s.dim}>{fmtDate(override.created_at)}</span>
                        <p className={p.overrideReason}>{override.reason}</p>
                      </div>
                    ) : (
                      isBlocking && (
                        <details className={p.overrideForm}>
                          <summary className={p.overrideSummary}>
                            Override this finding
                          </summary>
                          <form action={createOverrideAction}>
                            <input type="hidden" name="projectId" value={id} />
                            <input
                              type="hidden"
                              name="finding_index"
                              value={i}
                            />
                            <textarea
                              name="reason"
                              className={s.textarea}
                              placeholder="Why is this finding acceptable? Minimum 8 characters. This is recorded forever in the project ledger."
                              minLength={8}
                              required
                              rows={3}
                              aria-label={`Override reason for finding ${i + 1}`}
                            />
                            <div className={p.overrideActions}>
                              <SubmitButton
                                className={s.btnDanger}
                                pendingLabel="Recording…"
                              >
                                Record override
                              </SubmitButton>
                            </div>
                          </form>
                        </details>
                      )
                    )}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </main>
  );
}
