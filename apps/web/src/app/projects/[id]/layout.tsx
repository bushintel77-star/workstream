import { notFound } from "next/navigation";
import { requireSignedIn } from "../../../lib/auth";
import { getIntegrationSummary, getProject, listOutputs } from "../../../lib/api";
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
  const [outputs, summary] = await Promise.all([
    listOutputs(id).catch(() => []),
    getIntegrationSummary().catch(() => null),
  ]);
  const quote = outputs.find((output) => output.kind === "quote") ?? null;

  return (
    <ProjectChrome
      projectId={id}
      address={project.address}
      quoteUrl={quote?.uri ?? null}
      hasQuote={quote != null}
      summary={summary}
    >
      {children}
    </ProjectChrome>
  );
}
