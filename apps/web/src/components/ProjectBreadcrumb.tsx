"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import layout from "../app/projects/[id]/project-layout.module.css";

const SECTION_LABELS: Record<string, string> = {
  survey: "Survey",
  measurements: "Measurements",
  design: "Design",
  "design/cad": "CAD",
  "design/develop": "Develop",
  "design/studio": "Studio",
  costing: "Costing",
  carbon: "Carbon",
  audit: "Audit",
  outputs: "Outputs",
  tasks: "Tasks",
  recordings: "Recordings",
  filing: "Filing",
  processing: "Processing",
};

type Props = {
  projectId: string;
  address: string;
};

export function ProjectBreadcrumb({ projectId, address }: Props) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 3) return null;

  const subPath = segments.slice(2).join("/");
  const label = SECTION_LABELS[subPath] ?? subPath;
  const shortAddress =
    address.length > 40 ? `${address.slice(0, 40)}…` : address;

  return (
    <nav className={layout.breadcrumb} aria-label="Project breadcrumb">
      <Link href="/home" className={layout.breadcrumbLink}>
        Projects
      </Link>
      <span className={layout.breadcrumbSep} aria-hidden>/</span>
      <Link
        href={`/projects/${projectId}`}
        className={layout.breadcrumbLink}
      >
        {shortAddress}
      </Link>
      <span className={layout.breadcrumbSep} aria-hidden>/</span>
      <span className={layout.breadcrumbCurrent}>{label}</span>
    </nav>
  );
}
