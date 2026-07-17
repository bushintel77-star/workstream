import { notFound } from "next/navigation";
import { requireSignedIn } from "../../../lib/auth";
import {
  getIntegrationSummary,
  getProject,
  listOutputs,
} from "../../../lib/api";
import { ProjectChrome } from "../../../components/ProjectChrome";

export const dynamic = "force-dynamic";

/** Project shell: AppNav on hub routes; canvas-first design/CAD hides chrome. */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireSignedIn();
  const { id } = await params;
  const [project, outputs, summary] = await Promise.all([
    getProject(id),
    listOutputs(id).catch(() => []),
    getIntegrationSummary().catch(() => null),
  ]);

  if (!project) {
    notFound();
  }

  const quoteOutput = outputs.find((o) => o.kind === "quote");

  return (
    <ProjectChrome
      projectId={id}
      address={project.address}
      quoteUrl={quoteOutput?.uri ?? null}
      hasQuote={Boolean(quoteOutput)}
      clientName={project.client_name}
      clientEmail={project.client_email}
      summary={summary}
    >
      {children}
    </ProjectChrome>
  );
}
