"use client";

import { useState } from "react";
import type { EnvelopeBrief, SiteContext, Task, Project } from "../lib/api";
import { deriveSiteNextAction } from "@workstream/domain";
import { OutstandingPanel } from "./OutstandingPanel";
import { SiteHotLinks } from "./SiteHotLinks";
import { ProjectVoiceDock } from "./ProjectVoiceDock";

type Props = {
  project: Pick<
    Project,
    "id" | "address" | "status" | "client_name" | "client_email" | "lat" | "lng"
  >;
  siteContext: SiteContext | null;
  tasks: Task[];
  envelope: EnvelopeBrief | null;
  standardTotal: number | null;
  hasSurvey: boolean;
  hasDesign: boolean;
  hasCosting: boolean;
  auditPassed: boolean;
  hasQuote: boolean;
  hasCanvas: boolean;
  weatherRain: boolean;
  weatherWind: boolean;
};

export function SiteProjectWidgets(props: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const next = deriveSiteNextAction({
    status: props.project.status,
    hasSurvey: props.hasSurvey,
    hasDesign: props.hasDesign,
    hasCosting: props.hasCosting,
    auditPassed: props.auditPassed,
    hasQuote: props.hasQuote,
    hasCanvas: props.hasCanvas,
  });
  const workflow = [
    { label: "Survey / backyard mapped", done: props.hasSurvey },
    { label: "Back-of-envelope sketch", done: props.hasCanvas },
    { label: "Design developed", done: props.hasDesign },
    { label: "Priced", done: props.hasCosting },
    { label: "Audit passed", done: props.auditPassed },
    { label: "Quote generated", done: props.hasQuote },
  ];

  return (
    <>
      <SiteHotLinks
        {...props}
        onWhatsLeft={() => setSheetOpen(true)}
      />
      <ProjectVoiceDock
        projectId={props.project.id}
        onWhatsLeft={() => setSheetOpen(true)}
      />
      <OutstandingPanel
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        tasks={props.tasks}
        workflow={workflow}
        next={next}
      />
    </>
  );
}
