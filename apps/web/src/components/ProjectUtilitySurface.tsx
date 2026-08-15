import type {
  ActivityEvent,
  Audit,
  CarbonReport,
  Output,
  OutputKind,
  Override,
  PhotoMeasurement,
  Recording,
} from "../lib/api";
import {
  createOverrideAction,
  runAuditAction,
  runOutputAction,
} from "../app/actions";
import { SubmitButton } from "./SubmitButton";
import { PhotoMeasureUpload } from "./PhotoMeasureUpload";
import { RecordingUpload } from "./RecordingUpload";
import styles from "../app/projects/[id]/project.module.css";

const OUTPUTS: Array<{ kind: OutputKind; label: string; description: string }> = [
  { kind: "task_list", label: "Task list", description: "Site-ready actions and dependencies" },
  { kind: "schedule", label: "Schedule", description: "Construction sequence and timing" },
  { kind: "quote", label: "Quote", description: "Client-facing scope and pricing" },
  { kind: "brochure", label: "Presentation brochure", description: "A polished client handover" },
  { kind: "scope", label: "Scope of works", description: "Trade-ready project definition" },
  { kind: "establishment_calendar", label: "Establishment calendar", description: "Planting and aftercare plan" },
  { kind: "handover_pack", label: "Handover pack", description: "Completion documents and care notes" },
  { kind: "supplier_order", label: "Supplier order", description: "Materials and plant procurement" },
];

const DATE_FORMAT = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type ProjectUtilityProps =
  | {
      type: "audit";
      projectId: string;
      designReady: boolean;
      audit: Audit | null;
      overrides: Override[];
      activity: ActivityEvent[];
    }
  | { type: "carbon"; projectId: string; report: CarbonReport | null }
  | { type: "outputs"; projectId: string; outputs: Output[] }
  | {
      type: "measurements";
      projectId: string;
      measurements: PhotoMeasurement[];
    }
  | { type: "recordings"; projectId: string; recordings: Recording[] };

export function ProjectUtilitySurface(props: ProjectUtilityProps) {
  return (
    <main className={styles.pageNarrow}>
      {props.type === "audit" ? (
        <AuditSurface
          projectId={props.projectId}
          designReady={props.designReady}
          audit={props.audit}
          overrides={props.overrides}
          activity={props.activity}
        />
      ) : null}
      {props.type === "carbon" ? (
        <CarbonSurface report={props.report} />
      ) : null}
      {props.type === "outputs" ? (
        <OutputsSurface projectId={props.projectId} outputs={props.outputs} />
      ) : null}
      {props.type === "measurements" ? (
        <MeasurementsSurface
          projectId={props.projectId}
          measurements={props.measurements}
        />
      ) : null}
      {props.type === "recordings" ? (
        <RecordingsSurface
          projectId={props.projectId}
          recordings={props.recordings}
        />
      ) : null}
    </main>
  );
}

function formatDate(value: string): string {
  return DATE_FORMAT.format(new Date(value));
}

function formatKg(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 1,
  }).format(value);
}

export function AuditSurface({
  projectId,
  designReady,
  audit,
  overrides,
  activity,
}: {
  projectId: string;
  designReady: boolean;
  audit: Audit | null;
  overrides: Override[];
  activity: ActivityEvent[];
}) {
  return (
    <>
      <header className={styles.processingHero}>
        <p className={styles.totalKicker}>Design assurance</p>
        <h1 className={styles.headline}>Audit</h1>
        <p className={styles.processingCopy}>
          Check fidelity, completeness, coherence, cost, safety, and scope before
          issuing the design.
        </p>
        {designReady ? (
          <form action={runAuditAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <SubmitButton pendingLabel="Running audit…">
              {audit ? "Run audit again" : "Run design audit"}
            </SubmitButton>
          </form>
        ) : (
          <div className={styles.empty} role="status">
            <strong>Design required before audit</strong>
            <p>
              Generate or complete the design in the studio first. The audit checks
              the current design, not the initial site survey.
            </p>
            <a className={styles.utilityLink} href={`/projects/${projectId}/design`}>
              Open design studio
            </a>
          </div>
        )}
      </header>
      {audit && designReady ? (
        <>
          <div className={styles.kpiRow}>
            <span className={`${styles.pill} ${audit.passed ? styles.pillOk : styles.pillBlock}`}>
              {audit.passed ? "Passed" : "Action required"}
            </span>
            <span className={styles.pill}>{audit.blocking_count} blocking</span>
            <span className={styles.pill}>{audit.advisory_count} advisory</span>
          </div>
          <section aria-labelledby="audit-findings-heading">
            <h2 id="audit-findings-heading" className={styles.sectionHeading}>
              Findings
            </h2>
            {audit.findings.length === 0 ? (
              <div className={styles.empty}>No findings. The design is ready for the next stage.</div>
            ) : (
              audit.findings.map((finding, index) => {
                const override = overrides.find((item) => item.finding_index === index);
                return (
                  <article
                    key={`${finding.category}-${finding.location}-${index}`}
                    className={`${styles.finding} ${
                      finding.severity === "blocking"
                        ? styles.findingBlocking
                        : styles.findingAdvisory
                    }`}
                  >
                    <div className={styles.findingHead}>
                      <span className={styles.findingLocation}>{finding.location}</span>
                      <span className={styles.pill}>{finding.category}</span>
                    </div>
                    <p className={styles.findingStatement}>{finding.statement}</p>
                    <p className={styles.findingAction}>{finding.suggested_action}</p>
                    {override ? (
                      <div className={styles.overrideRecorded}>
                        <span className={styles.pill}>Override recorded</span>
                        <p className={styles.overrideReason}>{override.reason}</p>
                      </div>
                    ) : (
                      <details className={styles.overrideForm}>
                        <summary className={styles.overrideSummary}>Record professional override</summary>
                        <form action={createOverrideAction}>
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="finding_index" value={index} />
                          <label className={styles.label}>
                            Reason
                            <textarea
                              className={styles.textarea}
                              name="reason"
                              minLength={8}
                              required
                              placeholder="Explain why this finding is accepted or deferred."
                            />
                          </label>
                          <div className={styles.overrideActions}>
                            <SubmitButton variant="ghost">Save override</SubmitButton>
                          </div>
                        </form>
                      </details>
                    )}
                  </article>
                );
              })
            )}
          </section>
        </>
      ) : designReady ? (
        <div className={styles.empty}>Run the audit to surface design risks and issue readiness.</div>
      ) : null}
      {activity.length > 0 ? (
        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className={styles.sectionHeading}>
            Activity trail
          </h2>
          <div className={styles.card} role="list" aria-label="Project activity">
            {activity.map((event) => (
              <div
                className={styles.outputCard}
                role="listitem"
                key={event.id}
              >
                <div className={styles.outputMain}>
                  <span className={styles.outputKind}>{event.action}</span>
                  <span className={styles.outputMeta}>{event.detail}</span>
                </div>
                <span className={styles.mono}>{formatDate(event.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export function CarbonSurface({ report }: { report: CarbonReport | null }) {
  return (
    <>
      <header className={styles.processingHero}>
        <p className={styles.totalKicker}>Environmental ledger</p>
        <h1 className={styles.headline}>Carbon impact</h1>
        <p className={styles.processingCopy}>
          A transparent embodied-carbon view of the current design scenario.
        </p>
      </header>
      {report ? (
        <>
          <div className={styles.totalCard}>
            <span className={styles.totalKicker}>Estimated embodied carbon</span>
            <span className={styles.totalAmount}>{formatKg(report.total_kg_co2e)} kg</span>
            <span className={styles.totalSub}>Scenario: {report.scenario}</span>
          </div>
          <section aria-labelledby="carbon-category-heading">
            <h2 id="carbon-category-heading" className={styles.sectionHeading}>
              By category
            </h2>
            <div className={styles.grid2}>
              {Object.entries(report.by_category).map(([category, value]) => (
                <article className={styles.metric} key={category}>
                  <span className={styles.metricLabel}>{category}</span>
                  <span className={styles.metricValue}>{formatKg(value)} kg</span>
                </article>
              ))}
            </div>
          </section>
          <h2 className={styles.sectionHeading}>Ledger lines</h2>
          <div className={styles.card} role="list" aria-label="Carbon ledger lines">
            {report.lines.map((line) => (
              <div
                className={styles.outputCard}
                role="listitem"
                key={`${line.sku}-${line.label}`}
              >
                <div className={styles.outputMain}>
                  <span className={styles.outputKind}>{line.label}</span>
                  <span className={styles.outputMeta}>
                    {line.qty} {line.unit} · {line.sku}
                  </span>
                </div>
                <span className={styles.mono}>{formatKg(line.total_kg_co2e)} kg</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.empty}>Carbon reporting becomes available once the design has a priced scenario.</div>
      )}
    </>
  );
}

export function OutputsSurface({
  projectId,
  outputs,
}: {
  projectId: string;
  outputs: Output[];
}) {
  return (
    <>
      <header className={styles.processingHero}>
        <p className={styles.totalKicker}>Deliverables</p>
        <h1 className={styles.headline}>Outputs</h1>
        <p className={styles.processingCopy}>
          Generate the documents that carry the design from canvas to site.
        </p>
      </header>
      <section className={styles.card} aria-labelledby="output-generation-heading">
        <h2 id="output-generation-heading" className={styles.sectionHeading}>
          Generate documents
        </h2>
        {OUTPUTS.map((item) => {
          const output = outputs.find((candidate) => candidate.kind === item.kind);
          return (
            <div className={styles.outputCard} key={item.kind}>
              <div className={styles.outputMain}>
                <span className={styles.outputKind}>{item.label}</span>
                <span className={styles.outputMeta}>
                  {output ? `Generated ${formatDate(output.generated_at)}` : item.description}
                </span>
              </div>
              <div className={styles.outputActions}>
                {output ? (
                  <a
                    className={styles.utilityLink}
                    href={output.uri}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${item.label} in a new tab`}
                  >
                    Open output
                  </a>
                ) : null}
                <form action={runOutputAction}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="kind" value={item.kind} />
                  <SubmitButton variant="ghost" pendingLabel="Working…">
                    {output ? "Regenerate" : "Generate"}
                  </SubmitButton>
                </form>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

export function RecordingsSurface({
  projectId,
  recordings,
}: {
  projectId: string;
  recordings: Recording[];
}) {
  return (
    <>
      <header className={styles.processingHero}>
        <p className={styles.totalKicker}>Site voice notes</p>
        <h1 className={styles.headline}>Recordings</h1>
        <p className={styles.processingCopy}>
          Capture the site conversation — transcription feeds survey, design,
          and cost in the background.
        </p>
      </header>
      <RecordingUpload projectId={projectId} />
      {recordings.length > 0 ? (
        <section aria-labelledby="recordings-heading">
          <h2 id="recordings-heading" className={styles.sectionHeading}>
            Captured notes
          </h2>
          {recordings.map((recording) => (
            <article className={styles.recordingCard} key={recording.id}>
              <div className={styles.recordingMeta}>
                <span className={styles.mono}>{Math.round(recording.duration_s)} sec</span>
                {recording.transcription_confidence != null ? (
                  <span className={styles.pill}>
                    {Math.round(recording.transcription_confidence * 100)}% confidence
                  </span>
                ) : null}
              </div>
              {recording.transcript ? (
                <p className={styles.transcript}>{recording.transcript}</p>
              ) : (
                <p className={`${styles.transcript} ${styles.transcriptPending}`}>
                  Transcription in progress.
                </p>
              )}
              <audio
                controls
                preload="none"
                src={recording.audio_uri}
                aria-label={`Play site recording, ${Math.round(recording.duration_s)} seconds`}
              >
                Your browser does not support audio playback.
              </audio>
            </article>
          ))}
        </section>
      ) : (
        <div className={styles.empty}>No site recordings have been captured yet.</div>
      )}
    </>
  );
}

const UNIT_LABEL: Record<PhotoMeasurement["items"][number]["unit"], string> = {
  meters: "m",
  centimeters: "cm",
  millimeters: "mm",
  square_meters: "m²",
  cubic_meters: "m³",
  unknown: "—",
};

export function MeasurementsSurface({
  projectId,
  measurements,
}: {
  projectId: string;
  measurements: PhotoMeasurement[];
}) {
  return (
    <>
      <header className={styles.processingHero}>
        <p className={styles.totalKicker}>Site dimensions</p>
        <h1 className={styles.headline}>Measurements</h1>
        <p className={styles.processingCopy}>
          Vision-measured quantities from site photos — each value carries its
          reference and confidence. Confirm against tape before construction.
        </p>
      </header>
      <PhotoMeasureUpload projectId={projectId} />
      {measurements.length > 0 ? (
        <section aria-labelledby="measurements-heading">
          <h2 id="measurements-heading" className={styles.sectionHeading}>
            Captured measurements
          </h2>
          {measurements.map((measurement) => (
            <article
              className={styles.measurementCard}
              key={measurement.id}
              data-testid="measurement-card"
            >
              <div className={styles.measurementHead}>
                <span className={styles.mono}>
                  {formatDate(measurement.created_at)}
                </span>
                <span className={styles.pill}>
                  {measurement.items.length}{" "}
                  {measurement.items.length === 1 ? "item" : "items"}
                </span>
              </div>
              {measurement.items.length > 0 ? (
                <div className={styles.card} role="list">
                  {measurement.items.map((item, index) => (
                    <div
                      className={styles.outputCard}
                      role="listitem"
                      key={`${measurement.id}-${index}`}
                    >
                      <div className={styles.outputMain}>
                        <span className={styles.outputKind}>
                          {item.description}
                        </span>
                        <span className={styles.outputMeta}>
                          {item.reference_used
                            ? `ref: ${item.reference_used}`
                            : "no stated reference"}
                        </span>
                      </div>
                      <span className={styles.mono}>
                        {item.value.toFixed(2)} {UNIT_LABEL[item.unit]} ·{" "}
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>
                  No quantities were extracted from this photo.
                </p>
              )}
              {measurement.notes ? (
                <p className={styles.findingStatement}>{measurement.notes}</p>
              ) : null}
              <a
                className={styles.utilityLink}
                href={measurement.image_uri}
                target="_blank"
                rel="noreferrer"
              >
                Open source photo
              </a>
            </article>
          ))}
        </section>
      ) : (
        <div className={styles.empty}>
          No photo measurements yet — upload a site photo above.
        </div>
      )}
    </>
  );
}
