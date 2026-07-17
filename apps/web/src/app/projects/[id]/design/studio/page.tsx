import { redirect } from "next/navigation";

/** Alias — sketch lives at /design, canvas-first. */
export default async function DesignStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/design`);
}
