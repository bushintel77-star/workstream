import Link from "next/link";
import p from "../app/projects/[id]/project.module.css";

type Props = {
  n: number;
  label: string;
  status: "done" | "todo" | "locked" | "blocked";
  href: string;
  meta: string;
};

export function PipelineStage({ n, label, status, href, meta }: Props) {
  const cls =
    status === "done"
      ? p.stageDone
      : status === "blocked"
        ? p.stageBlocked
        : "";

  if (status === "locked") {
    return (
      <div className={`${p.stage} ${p.stageLocked}`} aria-disabled="true">
        <span className={p.stageNum}>0{n}</span>
        <span className={p.stageLabel}>{label}</span>
        <span className={p.stageMeta}>{meta}</span>
      </div>
    );
  }

  return (
    <Link href={href} className={`${p.stage} ${cls}`}>
      <span className={p.stageNum}>0{n}</span>
      <span className={p.stageLabel}>{label}</span>
      <span className={p.stageMeta}>{meta}</span>
    </Link>
  );
}
