import { notFound } from "next/navigation";
import { SiteCanvas } from "../../../components/canvas/SiteCanvas";
import {
  getCadDocumentApi,
  getDesignCanvas,
  getProject,
  getSiteBoundaryApi,
  getSurvey,
} from "../../../lib/api";
import { requireSignedIn } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function ProjectCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSignedIn();
  const { id } = await params;
  const [project, survey, cad, canvas, boundaryRes] = await Promise.all([
    getProject(id),
    getSurvey(id).catch(() => null),
    getCadDocumentApi(id).catch(() => ({
      document: null,
      svg: null,
      ghost_count: 0,
    })),
    getDesignCanvas(id).catch(() => null),
    getSiteBoundaryApi(id).catch(() => ({ boundary: null })),
  ]);

  if (!project) notFound();

  return (
    <SiteCanvas
      projectId={id}
      projectAddress={project.address}
      aerialUri={survey?.aerial_uri ?? null}
      initialDocument={cad.document}
      initialSvg={cad.svg}
      initialGhostCount={cad.ghost_count}
      initialBoundary={boundaryRes.boundary}
      key={canvas?.updated_at ?? id}
    />
  );
}
