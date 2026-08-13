import { notFound } from "next/navigation";
import { getDesignCanvas, getProject } from "../../../lib/api";
import { requireSignedIn } from "../../../lib/auth";
import { buildGrowthPlantInstances } from "../../../components/canvas/growthStudio/growthStudioData";
import { GrowthStudioClient } from "../../../components/canvas/growthStudio/GrowthStudioClient";

export const dynamic = "force-dynamic";

/**
 * Growth Studio — a new, standalone 3D surface (dark glass-HUD chrome, not
 * the operator canvas's design system). Deliberately lives outside
 * `/projects/[id]` so it isn't wrapped by `ProjectChrome`'s breadcrumb / status
 * bar — this view owns the full viewport. Reads the real design canvas so the
 * simulation reflects what is actually on the board, not a demo scene.
 */
export default async function GrowthStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSignedIn();
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const canvas = await getDesignCanvas(id).catch(() => null);
  const instances = buildGrowthPlantInstances(canvas?.placements);

  return (
    <GrowthStudioClient
      projectAddress={project.address}
      backHref={`/projects/${id}`}
      lat={project.lat ?? null}
      lng={project.lng ?? null}
      boardWidthM={canvas?.site_frame?.board_width_m ?? null}
      instances={instances}
    />
  );
}
