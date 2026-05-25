"use client";

import type { ReactNode } from "react";
import shell from "./studioDesktopShell.module.css";
import { StudioTopbar } from "./StudioTopbar";
import { StudioToolRail } from "./StudioToolRail";
import { StudioCanvas } from "./StudioCanvas";
import { StudioRightRail } from "./StudioRightRail";
import { StudioStatusBar } from "./StudioStatusBar";

type Props = {
  projectId: string;
  projectAddress: string;
  canvas: ReactNode;
  rightRail?: ReactNode;
  topbarExtras?: ReactNode;
};

/** Full-viewport CAD shell — Workflow 1 desktop layout. */
export function StudioDesktopShell({
  projectId,
  projectAddress,
  canvas,
  rightRail,
  topbarExtras,
}: Props) {
  return (
    <div className={shell.shell} data-testid="studio-desktop-shell">
      <StudioTopbar
        projectId={projectId}
        projectAddress={projectAddress}
        extras={topbarExtras}
      />
      <div className={shell.workspace}>
        <StudioToolRail />
        <StudioCanvas>{canvas}</StudioCanvas>
        <StudioRightRail>{rightRail}</StudioRightRail>
      </div>
      <StudioStatusBar />
    </div>
  );
}
