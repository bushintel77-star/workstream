/**
 * PDF page → PNG for DesignCanvas image underlays (raster only).
 */

export type PdfPageRaster = {
  blob: Blob;
  fileName: string;
  naturalAspect: number;
};

/** Render PDF page 1 to a PNG blob via pdf.js. */
export async function rasterizePdfFirstPage(file: File): Promise<PdfPageRaster> {
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Not a PDF");
  }

  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))),
      "image/png",
    );
  });

  return {
    blob,
    fileName: `${file.name.replace(/\.pdf$/i, "")}-p1.png`,
    naturalAspect: canvas.width / Math.max(1, canvas.height),
  };
}
