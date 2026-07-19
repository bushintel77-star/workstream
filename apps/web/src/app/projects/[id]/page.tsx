import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HandoffDesignStudio } from "../../../components/canvas/handoff/HandoffDesignStudio";
import { getProject, getSurvey } from "../../../lib/api";
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
    v === "quote"
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
  const [project, survey] = await Promise.all([
    getProject(id),
    getSurvey(id).catch(() => null),
  ]);

  if (!project) notFound();

  return (
    <Suspense fallback={null}>
      <HandoffDesignStudio
        projectId={id}
        projectAddress={project.address}
        aerialUri={survey?.aerial_uri ?? null}
        areaM2={
          survey?.garden_area_m2 ?? survey?.lot_area_m2 ?? 230.82
        }
        initialMode={parseMode(sp.mode)}
      />
    </Suspense>
  );
}
