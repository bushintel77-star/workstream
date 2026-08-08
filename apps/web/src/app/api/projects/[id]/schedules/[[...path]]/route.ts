import { NextRequest, NextResponse } from "next/server";
import { getApiUrl, upstreamAuthHeaders } from "../../../../../../lib/upstream-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; path?: string[] }> },
) {
  const { id, path = [] } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  }
  const suffix = path.length ? `/${path.join("/")}` : "";
  const url = new URL(req.url);
  const upstream = `${getApiUrl()}/projects/${id}/schedules${suffix}${url.search}`;
  const headers = await upstreamAuthHeaders();
  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "GET",
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
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
      "content-disposition":
        res.headers.get("content-disposition") ?? "",
    },
  });
}

export const GET = proxy;
