import { notFound } from "next/navigation";
import { SketchPad } from "../../../../components/canvas/sketch/SketchPad";
import { getDesignCanvas, getProject, getSurvey } from "../../../../lib/api";
import { requireSignedIn } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

/**
 * Sketch Pad route — canvas-first, minimal-chrome sketching over the site
 * aerial. A dedicated full-screen surface (no pipeline banner, no studio
 * chrome). Loads the same project/survey/canvas data as the main page.
 */
export default async function SketchPadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSignedIn();
  const { id } = await params;
  const [project, survey, canvas] = await Promise.all([
    getProject(id),
    getSurvey(id),
    getDesignCanvas(id),
  ]);

  if (!project) notFound();

  const aerialUri = survey?.aerial_uri ?? null;
  const strokes = canvas?.strokes ?? [];
  const scaleM = canvas?.site_frame?.board_width_m ?? 40;
  // Derive board aspect from the boundary if present, else square.
  const boundary = canvas?.site_frame?.boundary;
  const boardAspect =
    boundary && boundary.length > 0
      ? (() => {
          const ys = boundary.map((p) => p.y_pct);
          const xs = boundary.map((p) => p.x_pct);
          const w = Math.max(...xs) - Math.min(...xs) || 100;
          const h = Math.max(...ys) - Math.min(...ys) || 100;
          return h / w;
        })()
      : 1;

  return (
    <SketchPad
      aerialUri={aerialUri}
      scaleM={scaleM}
      boardAspect={boardAspect}
      initialStrokes={strokes}
      projectTitle={project.address}
    />
  );
}
