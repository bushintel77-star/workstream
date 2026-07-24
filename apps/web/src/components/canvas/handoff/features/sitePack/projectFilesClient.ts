/** Browser helpers for project filing via Next BFF (not server-only api.ts). */

export type ClientProjectFile = {
  id: string;
  kind: string;
  title: string;
  mime_type: string;
  uri: string;
  created_at: string;
};

export async function listProjectFilesClient(
  projectId: string,
): Promise<ClientProjectFile[]> {
  const res = await fetch(`/api/projects/${projectId}/files`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`List files failed (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { files: ClientProjectFile[] };
  return body.files ?? [];
}

export async function uploadProjectFileClient(
  projectId: string,
  file: File,
  kind: "byda" | "council_drain" | "other" = "byda",
): Promise<ClientProjectFile> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("kind", kind);
  fd.append("title", file.name);
  const res = await fetch(`/api/projects/${projectId}/files`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { file: ClientProjectFile };
  return body.file;
}
