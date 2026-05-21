import Link from "next/link";
import p from "../app/projects/[id]/project.module.css";

export type PipelineStage = {
  n: number;
  label: string;
  status: "done" | "todo" | "locked" | "blocked";
  href: string;
  meta: string;
};

export function PipelineRail({ stages }: { stages: PipelineStage[] }) {
  const nextIdx = stages.findIndex(
    (s) => s.status === "todo" || s.status === "blocked",
  );

  return (
    <div className={p.pipelineWrap}>
      <ol className={p.pipeline}>
        {stages.map((stage, i) => {
          const cls =
            stage.status === "done"
              ? p.stageDone
              : stage.status === "blocked"
                ? p.stageBlocked
                : i === nextIdx
                  ? p.stageNext
                  : "";
          const locked = stage.status === "locked";
          const inner = (
            <>
              <span className={p.stageNum}>0{stage.n}</span>
              <span className={p.stageLabel}>{stage.label}</span>
              <span className={p.stageMeta}>{stage.meta}</span>
              {i === nextIdx && stage.status !== "locked" && (
                <span className={p.stageNextBadge}>Next</span>
              )}
            </>
          );
          return (
            <li key={stage.label}>
              {locked ? (
                <div className={`${p.stage} ${p.stageLocked}`}>{inner}</div>
              ) : (
                <Link href={stage.href} className={`${p.stage} ${cls}`}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
