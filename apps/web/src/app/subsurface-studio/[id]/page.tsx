import { notFound } from "next/navigation";
import { getDesignCanvas, getProject } from "../../../lib/api";
import { requireSignedIn } from "../../../lib/auth";
import {
  buildSubsurfaceScene,
  DEFAULT_BOARD_WIDTH_M,
} from "../../../components/canvas/subsurfaceStudio/subsurfaceStudioData";
import { SubsurfaceStudioClient } from "../../../components/canvas/subsurfaceStudio/SubsurfaceStudioClient";

export const dynamic = "force-dynamic";

/**
 * Subsurface Studio — Gold Standard 3D view of real underground systems
 * (construction trenches, irrigation flow, LV lighting circuit, BYDA
 * utilities, easements). Lives outside `/projects/[id]` for the same reason
 * Growth Studio does — full-viewport chrome, no ProjectChrome wrapper.
 */
export default async function SubsurfaceStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSignedIn();
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const canvas = await getDesignCanvas(id).catch(() => null);
  const boardWidthM = canvas?.site_frame?.board_width_m ?? DEFAULT_BOARD_WIDTH_M;
  const scene = buildSubsurfaceScene({
    trenches: canvas?.construction_trenches,
    irrigationZones: canvas?.irrigation_zones,
    bydaAssets: canvas?.site_frame?.byda_assets,
    easements: canvas?.site_frame?.easements,
    placements: canvas?.placements,
    boardWidthM,
  });

  return (
    <SubsurfaceStudioClient
      projectAddress={project.address}
      backHref={`/projects/${id}`}
      lat={project.lat ?? null}
      lng={project.lng ?? null}
      boardWidthM={canvas?.site_frame?.board_width_m ?? null}
      scene={scene}
    />
  );
}
