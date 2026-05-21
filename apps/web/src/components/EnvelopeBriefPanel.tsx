import Link from "next/link";
import type { EnvelopeBrief } from "../lib/api";
import s from "./envelopeBrief.module.css";

type Props = {
  projectId: string;
  envelope: EnvelopeBrief;
};

function aud(n: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function EnvelopeBriefPanel({ projectId, envelope }: Props) {
  const planning = envelope.planning_flags.filter(
    (f) => f.id !== "scope-envelope",
  );

  return (
    <section className={s.panel} aria-label="Envelope brief">
      <h2 className={s.title}>Back-of-envelope brief</h2>
      <p className={s.sub}>
        Rough scope and budget for the client conversation — not a contract
        quote. Planning flags update as you change the sketch.
      </p>

      {envelope.budget_mid > 0 ? (
        <div className={s.budget}>
          <span className={s.budgetLabel}>Budget band (incl. GST)</span>
          <span className={s.budgetValue}>
            {aud(envelope.budget_low)} – {aud(envelope.budget_high)}
          </span>
          <span className={s.budgetMid}>Midpoint {aud(envelope.budget_mid)}</span>
        </div>
      ) : (
        <p className={s.hint}>
          Run <strong>Sketch estimate</strong> after saving the studio layout.
        </p>
      )}

      {planning.length > 0 && (
        <>
          <h3 className={s.sectionTitle}>Planning & permits</h3>
          <ul className={s.flagList}>
            {planning.map((f) => (
              <li key={f.id} className={s.flagItem}>
                <span
                  className={`${s.badge} ${f.severity === "likely" ? s.badgeLikely : f.severity === "review" ? s.badgeReview : s.badgeClear}`}
                >
                  {f.severity === "likely"
                    ? "Likely"
                    : f.severity === "review"
                      ? "Review"
                      : "OK"}
                </span>
                <div>
                  <strong>{f.title}</strong>
                  <p className={s.flagDetail}>{f.detail}</p>
                  {f.output_kind && (
                    <Link
                      href={`/projects/${projectId}/outputs`}
                      className={s.outputLink}
                    >
                      Draft {f.output_kind.replace(/_/g, " ")} →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className={s.footnote}>
        Mark <strong>Tree protection zone</strong> or{" "}
        <strong>Existing tree (retain)</strong> on the sketch when TRP applies.
        Confirm overlay and TPZ with planning certificate and arborist.
      </p>
    </section>
  );
}
