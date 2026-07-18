import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SiteCanvas } from "../../../components/canvas/SiteCanvas";
import {
  getCadDocumentApi,
  getDesignCanvas,
  getProject,
  getSiteBoundaryApi,
  getSurvey,
  listCatalogSymbols,
  listOutputs,
  listRateCard,
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
  const [project, survey, cad, canvas, boundaryRes, outputs] =
    await Promise.all([
      getProject(id),
      getSurvey(id).catch(() => null),
      getCadDocumentApi(id).catch(() => ({
        document: null,
        svg: null,
        ghost_count: 0,
      })),
      getDesignCanvas(id).catch(() => null),
      getSiteBoundaryApi(id).catch(() => ({ boundary: null })),
      listOutputs(id).catch(() => []),
    ]);

  if (!project) notFound();

  const quoteOutput = outputs.find((o) => o.kind === "quote");

  let sketch = null;
  if (survey) {
    const [symbols, rateCard] = await Promise.all([
      listCatalogSymbols(),
      listRateCard(),
    ]);
    sketch = {
      aerialUri: survey.aerial_uri,
      lotRing: survey.title_polygon.coordinates[0] as [number, number][],
      symbols,
      rateCard,
      canvas,
      surveyMetrics: {
        garden_area_m2: survey.garden_area_m2,
        lot_area_m2: survey.lot_area_m2,
        house_area_m2: survey.house_area_m2,
        lat: project.lat,
        lng: project.lng,
      },
    };
  }

  return (
    <Suspense fallback={null}>
      <SiteCanvas
        projectId={id}
        projectAddress={project.address}
        aerialUri={survey?.aerial_uri ?? null}
        initialDocument={cad.document}
        initialSvg={cad.svg}
        initialGhostCount={cad.ghost_count}
        initialBoundary={boundaryRes.boundary}
        sketch={sketch}
        quoteUrl={quoteOutput?.uri ?? null}
        hasQuote={Boolean(quoteOutput)}
        key={canvas?.updated_at ?? id}
      />
    </Suspense>
  );
}
