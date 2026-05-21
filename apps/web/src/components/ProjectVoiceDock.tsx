"use client";

import Link from "next/link";
import { GARDEN_COPY } from "@workstream/domain";
import d from "./project-voice-dock.module.css";

export function ProjectVoiceDock({
  projectId,
  onWhatsLeft,
}: {
  projectId: string;
  onWhatsLeft: () => void;
}) {
  return (
    <div className={d.dock} role="toolbar" aria-label="Voice shortcuts">
      <p className={d.hint}>{GARDEN_COPY.voice.tapHint}</p>
      <div className={d.row}>
        <Link
          href={`/projects/${projectId}/recordings`}
          className={d.pill}
        >
          <span className={d.pillTitle}>{GARDEN_COPY.voice.walkthrough}</span>
          <span className={d.pillSub}>{GARDEN_COPY.voice.walkthroughSub}</span>
        </Link>
        <Link href={`/projects/${projectId}/tasks`} className={d.pill}>
          <span className={d.pillTitle}>{GARDEN_COPY.voice.note}</span>
          <span className={d.pillSub}>{GARDEN_COPY.voice.noteSub}</span>
        </Link>
        <button type="button" className={d.compact} onClick={onWhatsLeft}>
          {GARDEN_COPY.widgets.whatsLeft}
        </button>
      </div>
    </div>
  );
}
