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
  const upstream = `${getApiUrl()}/projects/${id}/design-branches${suffix}${url.search}`;
  const headers = await upstreamAuthHeaders(
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : { "content-type": "application/json" },
  );
  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text().catch(() => "");
  }
  let res: Response;
  try {
    res = await fetch(upstream, init);
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
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
