import { notFound, redirect } from "next/navigation";
import { getProject } from "../../../../lib/api";
import { requireSignedIn } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

/**
 * Sketch Pad route — REDIRECTED to the unified WebGL studio.
 *
 * The sketch pad is no longer a separate SVG route. It has been absorbed into
 * the Fused Rendering Context: the same R3F canvas renders strokes in both
 * plan view (flat ink) and 3D view (terrain-draped). There is no separate
 * component tree, no hard cut, no page load.
 *
 * This route redirects to the main project canvas with ?tool=sketch, which
 * the unified studio reads to activate sketch mode on mount. Existing bookmarks
 * and deep links continue to work — they land in the unified studio.
 */
export default async function SketchPadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSignedIn();
  const { id } = await params;
  // Verify the project exists before redirecting (gives a 404 vs a bad redirect).
  const project = await getProject(id);
  if (!project) notFound();
  redirect(`/projects/${id}?tool=sketch`);
}
