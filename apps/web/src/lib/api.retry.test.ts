import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// api.ts is a server-only module; provide the marker so vitest can load it.
vi.mock("server-only", () => ({}));

import { getProject, updateProjectClientApi } from "./api";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const PROJECT = { project: { id: "p1", address: "1 Test St" } };

describe("apiFetch transient retry (via getProject)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a 429 then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          429,
          { error: "Rate limit exceeded, retry in 1 seconds" },
          { "retry-after": "1" },
        ),
      )
      .mockResolvedValueOnce(jsonResponse(200, PROJECT));
    await expect(getProject("p1")).resolves.toEqual(PROJECT.project);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("waits out a short retry-after before the second attempt", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(429, { error: "Rate limit exceeded" }, { "retry-after": "2" }),
      )
      .mockResolvedValueOnce(jsonResponse(200, PROJECT));
    const p = getProject("p1");
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toEqual(PROJECT.project);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses bounded backoff when no retry-after is provided", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(
      jsonResponse(503, { error: "Temporarily unavailable" }),
    );
    const promise = getProject("p1");
    const rejection = expect(promise).rejects.toThrow("API 503 on GET /projects/p1");
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("surfaces a long numeric retry-after without retrying", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        429,
        { error: "Rate limit exceeded, retry in 57 seconds" },
        { "retry-after": "57" },
      ),
    );
    await expect(getProject("p1")).rejects.toThrow("API 429 on GET /projects/p1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a long HTTP-date retry-after without retrying", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        429,
        { error: "Rate limit exceeded" },
        { "retry-after": new Date(Date.now() + 60_000).toUTCString() },
      ),
    );
    await expect(getProject("p1")).rejects.toThrow("API 429 on GET /projects/p1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry PATCH mutations", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(503, { error: "Temporarily unavailable" }),
    );
    await expect(
      updateProjectClientApi("p1", { client_name: "Client" }),
    ).rejects.toThrow("API 503 on PATCH /projects/p1/client");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a 404 to null without retrying", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "Not found" }));
    await expect(getProject("p1")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
