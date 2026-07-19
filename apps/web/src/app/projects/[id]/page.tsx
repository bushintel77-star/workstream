import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HandoffDesignStudio } from "../../../components/canvas/handoff/HandoffDesignStudio";
import {
  getCadastralTitle,
  getDesignCanvas,
  getProject,
  getSurvey,
  listOutputs,
} from "../../../lib/api";
import { requireSignedIn } from "../../../lib/auth";
import type { StudioMode } from "../../../components/canvas/handoff/studioCatalog";

export const dynamic = "force-dynamic";

function parseMode(raw: string | string[] | undefined): StudioMode {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (
    v === "survey" ||
    v === "sketch" ||
    v === "cad" ||
    v === "elevation" ||
    v === "quote" ||
    v === "share"
  ) {
    return v;
  }
  return "cad";
}

export default async function ProjectCanvasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireSignedIn();
  const { id } = await params;
  const sp = await searchParams;
  const [project, survey, canvas, outputs, titleBlock] = await Promise.all([
    getProject(id),
    getSurvey(id).catch(() => null),
    getDesignCanvas(id).catch(() => null),
    listOutputs(id).catch(() => []),
    getCadastralTitle(id).catch(() => null),
  ]);

  if (!project) notFound();

  const quoteOut = outputs.find((o) => o.kind === "quote") ?? null;

  return (
    <Suspense fallback={null}>
      <HandoffDesignStudio
        projectId={id}
        projectAddress={project.address}
        aerialUri={survey?.aerial_uri ?? null}
        areaM2={
          titleBlock?.lotAreaM2 ??
          survey?.garden_area_m2 ??
          survey?.lot_area_m2 ??
          230.82
        }
        initialMode={parseMode(sp.mode)}
        initialPlacements={canvas?.placements ?? []}
        initialStrokes={canvas?.strokes ?? []}
        hasQuote={Boolean(quoteOut)}
        quotePortalUri={quoteOut?.uri ?? null}
        initialTitleBlock={titleBlock}
      />
    </Suspense>
  );
}
