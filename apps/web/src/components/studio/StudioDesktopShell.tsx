"use client";

import type { ReactNode } from "react";
import shell from "./studioDesktopShell.module.css";
import { StudioTopbar } from "./StudioTopbar";
import { StudioToolRail } from "./StudioToolRail";
import { StudioCanvas } from "./StudioCanvas";
import { StudioRightRail } from "./StudioRightRail";
import { StudioStatusBar } from "./StudioStatusBar";
import type { RightRailTab } from "./studioTypes";

type Props = {
  projectId: string;
  projectAddress: string;
  canvas: ReactNode;
  rightRail?: ReactNode;
  rightRailTab: RightRailTab;
  onRightRailTab: (tab: RightRailTab) => void;
  topbarExtras?: ReactNode;
  ribbon?: ReactNode;
  contextStrip?: ReactNode;
  sitePanel?: ReactNode;
  commandPalette?: ReactNode;
  focusMode?: boolean;
  ghostBar?: ReactNode;
  /** Soften chrome when an instrumental brush is armed. */
  instrumentArmed?: boolean;
};

/** Full-viewport CAD shell — Workflow 1 desktop layout. */
export function StudioDesktopShell({
  projectId,
  projectAddress,
  canvas,
  rightRail,
  rightRailTab,
  onRightRailTab,
  topbarExtras,
  ribbon,
  contextStrip,
  sitePanel,
  commandPalette,
  focusMode = false,
  ghostBar,
  instrumentArmed = false,
}: Props) {
  return (
    <div
      className={`${shell.shell} ${focusMode ? shell.shellFocus : ""} ${instrumentArmed ? shell.shellArmed : ""}`}
      data-testid="studio-desktop-shell"
      data-instrument-armed={instrumentArmed ? "true" : undefined}
    >
      {commandPalette}
      {!focusMode ? (
        <StudioTopbar
          projectId={projectId}
          projectAddress={projectAddress}
          extras={topbarExtras}
        />
      ) : null}
      {!focusMode && ribbon ? <div className={shell.ribbonSlot}>{ribbon}</div> : null}
      {!focusMode && contextStrip ? (
        <div className={shell.contextSlot}>{contextStrip}</div>
      ) : null}
      {!focusMode && sitePanel ? <div className={shell.siteSlot}>{sitePanel}</div> : null}
      <div className={shell.workspace}>
        {!focusMode ? <StudioToolRail /> : null}
        <div className={shell.canvasWrap}>
          {ghostBar}
          <StudioCanvas>{canvas}</StudioCanvas>
        </div>
        {!focusMode ? (
          <StudioRightRail activeTab={rightRailTab} onTab={onRightRailTab}>
            {rightRail}
          </StudioRightRail>
        ) : null}
      </div>
      <StudioStatusBar />
      {focusMode ? (
        <p className={shell.focusPill}>focus mode · press F to exit</p>
      ) : null}
    </div>
  );
}
