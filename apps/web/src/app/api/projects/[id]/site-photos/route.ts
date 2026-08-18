import { NextRequest, NextResponse } from "next/server";
import { getApiUrl, upstreamAuthHeaders } from "../../../../../lib/upstream-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Same-origin proxy for the site-photo gallery (photo-trace elevation):
 * list + multipart upload. Forwards auth to the API. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const upstream = `${getApiUrl()}/projects/${id}/site-photos`;
  const headers = await upstreamAuthHeaders();
  const res = await fetch(upstream, { headers, cache: "no-store" });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const upstream = `${getApiUrl()}/projects/${id}/site-photos/upload`;

  const extra = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) extra.set("content-type", contentType);
  const contentLength = req.headers.get("content-length");
  if (contentLength) extra.set("content-length", contentLength);

  const headers = await upstreamAuthHeaders(extra);

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
