import type { GalleryItem, ProjectFile } from "@workstream/contracts";
import type { Store } from "@workstream/db";

const IMAGE_MIME = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;

export function isGalleryImageMime(mime: string): boolean {
  return IMAGE_MIME.test(mime) || mime === "image/jpeg";
}

export async function buildProjectGallery(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<GalleryItem[]> {
  const items: GalleryItem[] = [];

  const files = await store.listProjectFiles(ownerId, projectId);
  for (const f of files) {
    items.push(fileToGalleryItem(f));
  }

  const measurements = await store.listPhotoMeasurements(ownerId, projectId);
  for (const m of measurements) {
    items.push({
      id: `measurement-${m.id}`,
      source: "measurement",
      kind: "site_photo",
      title: m.notes?.trim() || m.items[0]?.description || "Site measurement",
      mime_type: "image/jpeg",
      uri: m.image_uri,
      viewable: true,
      created_at: m.created_at,
    });
  }

  const outputs = await store.listOutputs(ownerId, projectId);
  for (const o of outputs) {
    if (o.uri) {
      items.push({
        id: `output-${o.id}`,
        source: "output",
        kind: o.kind.includes("permit") ? "permit" : "design",
        title: o.kind.replace(/_/g, " "),
        mime_type: "text/html",
        uri: o.uri,
        viewable: false,
        created_at: o.generated_at,
      });
    }
  }

  items.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return items;
}

export function fileToGalleryItem(f: ProjectFile): GalleryItem {
  return {
    id: f.id,
    source: "filing",
    kind: f.kind,
    title: f.title,
    mime_type: f.mime_type,
    uri: f.uri,
    viewable: isGalleryImageMime(f.mime_type),
    created_at: f.created_at,
  };
}

export function viewableGalleryItems(items: GalleryItem[]): GalleryItem[] {
  return items.filter((i) => i.viewable);
}
