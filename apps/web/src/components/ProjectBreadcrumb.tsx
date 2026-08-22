"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { projectSectionFromPathname } from "../lib/project-sections";
import layout from "../app/projects/[id]/project-layout.module.css";

type Props = {
  projectId: string;
  address: string;
};

export function ProjectBreadcrumb({ projectId, address }: Props) {
  const pathname = usePathname();
  const current = projectSectionFromPathname(pathname);
  if (!current || current.isCanvasRedirect) return null;

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
      <span className={layout.breadcrumbCurrent}>{current.label}</span>
    </nav>
  );
}
