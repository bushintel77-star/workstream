import { NextRequest, NextResponse } from "next/server";
import { getApiUrl, upstreamAuthHeaders } from "../../../../../../lib/upstream-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Get a single presentation document. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await ctx.params;
  if (!id?.trim() || !docId?.trim()) {
    return NextResponse.json(
      { error: "Missing project or document id" },
      { status: 400 },
    );
  }
  const upstream = `${getApiUrl()}/projects/${id}/presentation-documents/${docId}`;
  const headers = await upstreamAuthHeaders();
  let res: Response;
  try {
    res = await fetch(upstream, { headers, cache: "no-store" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Couldn't reach the API: ${msg}` },
      { status: 502 },
    );
  }
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type":
        res.headers.get("content-type") ?? "application/json",
    },
  });
}

/** Update a presentation document. */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await ctx.params;
  if (!id?.trim() || !docId?.trim()) {
    return NextResponse.json(
      { error: "Missing project or document id" },
      { status: 400 },
    );
  }
  const raw = await req.text().catch(() => "");
  const upstream = `${getApiUrl()}/projects/${id}/presentation-documents/${docId}`;
  const headers = await upstreamAuthHeaders({
    "content-type": "application/json",
  });
  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "PUT",
      headers,
      body: raw || "{}",
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Couldn't reach the API: ${msg}` },
      { status: 502 },
    );
  }
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type":
        res.headers.get("content-type") ?? "application/json",
    },
  });
}

/** Delete a presentation document. */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await ctx.params;
  if (!id?.trim() || !docId?.trim()) {
    return NextResponse.json(
      { error: "Missing project or document id" },
      { status: 400 },
    );
  }
  const upstream = `${getApiUrl()}/projects/${id}/presentation-documents/${docId}`;
  const headers = await upstreamAuthHeaders();
  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Couldn't reach the API: ${msg}` },
      { status: 502 },
    );
  }
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type":
        res.headers.get("content-type") ?? "application/json",
    },
  });
}
