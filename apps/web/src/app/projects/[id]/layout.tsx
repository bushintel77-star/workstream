import { notFound } from "next/navigation";
import { requireSignedIn } from "../../../lib/auth";
import { getProject } from "../../../lib/api";

export const dynamic = "force-dynamic";

/** Canvas-first: no pipeline chrome — project surface is the site canvas. */
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
  return children;
}
