import { redirect } from "next/navigation";
import { listProjects } from "../../lib/api";
import { requireSignedIn } from "../../lib/auth";
import { LazyWebGLStudioPreview } from "../../components/canvas/webgl/LazyWebGLStudioPreview";

export const dynamic = "force-dynamic";

/** Canonical "Projects" surface (AppNav's brand + "Projects" link both point
 * here). Operators land straight in the active canvas. With no projects yet,
 * this mounts the same canvas empty-shell as a real project — the command
 * palette (forced open by WebGLStudioPreview when projectId is "") is the
 * picker: search existing projects or start a new one by address. There is
 * no separate pre-canvas page. */
export default async function HomePage() {
  await requireSignedIn();

  let rawProjects: Awaited<ReturnType<typeof listProjects>> = [];
  try {
    rawProjects = await listProjects();
  } catch {
    /* fail open — let the command palette create the first project */
  }

  const mostRecent = rawProjects
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];

  if (mostRecent) {
    redirect(`/projects/${mostRecent.id}`);
  }

  return (
    <main aria-label="Design canvas" style={{ position: "fixed", inset: 0 }}>
      <LazyWebGLStudioPreview
        projectId=""
        scaleM={110}
        boardAspect={1}
        boundaryPct={[]}
      />
    </main>
  );
}
