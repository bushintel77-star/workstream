"use client";

import type { ReactNode } from "react";
import type { IntegrationSummary } from "../lib/api";
import layout from "../app/projects/[id]/project-layout.module.css";
import { ProjectBreadcrumb } from "./ProjectBreadcrumb";

type Props = {
  projectId: string;
  address: string;
  quoteUrl: string | null;
  hasQuote: boolean;
  clientName?: string | null;
  clientEmail?: string | null;
  summary: IntegrationSummary | null;
  children: ReactNode;
};

/**
 * One-canvas operator shell ? no AppNav / pipeline chrome on project routes.
 * Share lives in canvas Share mode; Settings stay on the home/settings pages.
 */
export function ProjectChrome({ projectId, address, children }: Props) {
  return (
    <div className={layout.canvasFirst}>
      <ProjectBreadcrumb projectId={projectId} address={address} />
      {children}
    </div>
  );
}
