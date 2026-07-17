"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppNav } from "./AppNav";
import { ProjectShareFab } from "./ProjectShareFab";
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

/** Canvas routes: no AppNav / share FAB ? studio/site canvas is the only chrome. */
function isCanvasFirstRoute(pathname: string): boolean {
  return (
    /\/projects\/[^/]+\/?$/.test(pathname) ||
    /\/projects\/[^/]+\/design(\/|$)/.test(pathname)
  );
}

export function ProjectChrome({
  projectId,
  address,
  quoteUrl,
  hasQuote,
  clientName,
  clientEmail,
  summary,
  children,
}: Props) {
  const pathname = usePathname() ?? "";
  const canvasFirst = isCanvasFirstRoute(pathname);

  if (canvasFirst) {
    return <div className={layout.canvasFirst}>{children}</div>;
  }

  return (
    <>
      <AppNav summary={summary} />
      <div className={layout.content}>{children}</div>
      <ProjectShareFab
        projectId={projectId}
        address={address}
        quoteUrl={quoteUrl}
        hasQuote={hasQuote}
        clientName={clientName}
        clientEmail={clientEmail}
      />
    </>
  );
}
