import { notFound } from "next/navigation";
import { requireSignedIn } from "../../../lib/auth";
import { getProject } from "../../../lib/api";
import { ProjectChrome } from "../../../components/ProjectChrome";

export const dynamic = "force-dynamic";

/** Project routes are canvas-first — no pipeline masthead. */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireSignedIn();
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <ProjectChrome
      projectId={id}
      address={project.address}
      quoteUrl={null}
      hasQuote={false}
      summary={null}
    >
      {children}
    </ProjectChrome>
  );
}
