import Link from "next/link";
import s from "./quoteWorkflowSteps.module.css";

type Props = {
  projectId: string;
  hasSurvey: boolean;
  hasCanvas: boolean;
  hasDesign: boolean;
  hasCosting: boolean;
};

export function QuoteWorkflowSteps({
  projectId,
  hasSurvey,
  hasCanvas,
  hasDesign,
  hasCosting,
}: Props) {
  const steps = [
    {
      n: 1,
      label: "Survey",
      done: hasSurvey,
      href: `/projects/${projectId}/survey`,
    },
    {
      n: 2,
      label: "Sketch on aerial",
      done: hasCanvas,
      href: `/projects/${projectId}/design#design-studio`,
    },
    {
      n: 3,
      label: "Envelope estimate",
      done: hasCosting && !hasDesign,
      href: hasCanvas
        ? `/projects/${projectId}/design/develop#envelope-estimate`
        : `/projects/${projectId}/design#design-studio`,
      hint: "Budget + planning",
    },
    {
      n: 4,
      label: "AI design from sketch",
      done: hasDesign,
      href: `/projects/${projectId}/design/develop`,
    },
    {
      n: 5,
      label: "Cost & quote",
      done: hasCosting && hasDesign,
      href: `/projects/${projectId}/costing`,
    },
  ];

  return (
    <ol className={s.steps} aria-label="Quote workflow">
      {steps.map((step) => (
        <li
          key={step.n}
          className={`${s.step} ${step.done ? s.stepDone : ""}`}
        >
          <span className={s.num}>{step.done ? "✓" : step.n}</span>
          <span className={s.body}>
            {step.href && !step.done ? (
              <Link href={step.href} className={s.link}>
                {step.label}
              </Link>
            ) : (
              <span>{step.label}</span>
            )}
            {step.hint && <span className={s.hint}>{step.hint}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
