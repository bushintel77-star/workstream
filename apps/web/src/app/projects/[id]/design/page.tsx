import Link from "next/link";
import { requireProject } from "../../../../lib/project-guard";
import {
  getDesign,
  getDesignCanvas,
  getSurvey,
  listCatalogSymbols,
  listCostings,
  listRateCard,
} from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";
import { QuoteWorkflowSteps } from "../../../../components/QuoteWorkflowSteps";
import { DesignStudioSection } from "./DesignStudioSection";

export const dynamic = "force-dynamic";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const survey = await getSurvey(id);
  const [design, canvas, costings, symbols, rateCard] = await Promise.all([
    getDesign(id),
    getDesignCanvas(id),
    listCostings(id).catch(() => []),
    survey ? listCatalogSymbols() : Promise.resolve([]),
    survey ? listRateCard() : Promise.resolve([]),
  ]);
  const hasCanvas = (canvas?.placements?.length ?? 0) > 0;

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="design" />

      <h1 className={s.headline}>Design</h1>
      <p className={s.lede}>
        Concept sketch on the survey aerial — place Curtis assets, mass planting,
        irrigation, and live schedule. Save before opening outputs.
      </p>

      {!survey ? (
        <div className={s.actionBar}>
          <Link href={`/projects/${id}/survey`} className={s.btn}>
            Complete survey first
          </Link>
        </div>
      ) : (
        <>
          <QuoteWorkflowSteps
            projectId={id}
            hasSurvey={!!survey}
            hasCanvas={hasCanvas}
            hasDesign={!!design}
            hasCosting={costings.length > 0}
          />

          <DesignStudioSection
            projectId={id}
            aerialUri={survey.aerial_uri}
            lotRing={survey.title_polygon.coordinates[0] as [number, number][]}
            symbols={symbols}
            rateCard={rateCard}
            canvas={canvas}
          />

          <p className={s.meta}>
            <Link href={`/projects/${id}/design/develop`}>
              Develop & estimate from sketch →
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
