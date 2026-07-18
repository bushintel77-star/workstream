"use client";

import type { ReactNode } from "react";
import type { IntegrationSummary } from "../lib/api";
import layout from "../app/projects/[id]/project-layout.module.css";

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
export function ProjectChrome({ children }: Props) {
  return <div className={layout.canvasFirst}>{children}</div>;
}
