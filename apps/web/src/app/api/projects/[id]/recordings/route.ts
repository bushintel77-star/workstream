import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Same-origin proxy for audio uploads from the web app. The browser
 * POSTs multipart/form-data to /api/projects/<id>/recordings on the
 * Next host, this handler forwards the raw body to the API. Keeps the
 * browser side free of CORS concerns and the API URL out of the bundle. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const upstream = `${API_URL}/projects/${id}/recordings`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const contentLength = req.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);

  const res = await fetch(upstream, {
    method: "POST",
    headers,
    body: req.body,
    /* @ts-expect-error — Node fetch needs this for streaming bodies */
    duplex: "half",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
