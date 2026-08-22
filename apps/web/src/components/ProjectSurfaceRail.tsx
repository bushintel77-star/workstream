"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PROJECT_SURFACES,
  SURFACE_GROUP_LABELS,
  projectSectionFromPathname,
  type ProjectSurfaceGroup,
} from "../lib/project-sections";
import layout from "../app/projects/[id]/project-layout.module.css";

const GROUPS: ProjectSurfaceGroup[] = ["studios", "records"];

type Props = {
  projectId: string;
};

/**
 * Lateral navigation between a project's non-canvas surfaces.
 *
 * The canvas keeps its Zero-Chrome viewport: this renders only once the operator
 * has stepped off the drawing into the records area (reached from the studio
 * masthead's Outputs link), never over `/projects/[id]` itself and never on the
 * legacy sections that only redirect back onto the canvas.
 *
 * It is the only inbound link to the Growth studio, which shipped with none —
 * `scripts/check-route-reachability.mjs` fails if that ever stops being true.
 */
export function ProjectSurfaceRail({ projectId }: Props) {
  const pathname = usePathname();
  const current = projectSectionFromPathname(pathname);
  if (!current || current.isCanvasRedirect) return null;

  return (
    <nav className={layout.surfaceRail} aria-label="Project surfaces">
      {GROUPS.map((group) => (
        <div className={layout.surfaceGroup} key={group}>
          <span className={layout.surfaceGroupLabel}>
            {SURFACE_GROUP_LABELS[group]}
          </span>
          <ul className={layout.surfaceList}>
            {PROJECT_SURFACES.filter((surface) => surface.group === group).map(
              (surface) => {
                const active = surface.id === current.section;
                return (
                  <li key={surface.id}>
                    <Link
                      href={surface.href(projectId)}
                      className={layout.surfaceLink}
                      aria-current={active ? "page" : undefined}
                      data-active={active ? "" : undefined}
                    >
                      <span className={layout.surfaceLabel}>{surface.label}</span>
                      <span className={layout.surfaceHint}>{surface.hint}</span>
                    </Link>
                  </li>
                );
              },
            )}
          </ul>
        </div>
      ))}
    </nav>
  );
}
