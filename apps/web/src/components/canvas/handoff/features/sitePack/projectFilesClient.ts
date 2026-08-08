/**
 * Browser helpers for project filing via Next BFF (not server-only api.ts).
 *
 * Single client for the `/api/projects/:id/files` pair — the sketch image-layer
 * panel used to carry its own copy of both calls, which meant two places knew
 * the endpoint and only one of them typed `kind` against the contract.
 */

import type { ProjectFile, ProjectFileKind } from "@workstream/contracts";

export async function listProjectFilesClient(
  projectId: string,
): Promise<ProjectFile[]> {
  const res = await fetch(`/api/projects/${projectId}/files`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`List files failed (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { files: ProjectFile[] };
  return body.files ?? [];
}

export async function uploadProjectFileClient(
  projectId: string,
  file: File,
  opts: { kind?: ProjectFileKind; title?: string } = {},
): Promise<ProjectFile> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("kind", opts.kind ?? "byda");
  fd.append("title", opts.title ?? file.name);
  const res = await fetch(`/api/projects/${projectId}/files`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { file: ProjectFile };
  return body.file;
}
