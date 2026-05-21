import { describe, expect, it, vi, afterEach } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { crmPayloadFromProject, postCrmWebhook } from "./crm-webhook";

describe("postCrmWebhook", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns not configured without URL", async () => {
    const store = createMemoryStore();
    const owner = "o1";
    const project = await store.createProject(owner, {
      address: "1 Test St, Carlton VIC 3053",
    });
    const result = await postCrmWebhook(
      store,
      owner,
      crmPayloadFromProject(project, "project.created"),
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("not configured");
  });

  it("POSTs JSON when URL is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    const store = createMemoryStore();
    const owner = "o2";
    await store.setIntegration(owner, "CRM_WEBHOOK_URL", "https://crm.example/hook");
    const project = await store.createProject(owner, {
      address: "2 Test St, Prahran VIC 3181",
    });
    const payload = crmPayloadFromProject(project, "quote.generated", {
      quote_url: "https://api/outputs/q.html",
    });
    const result = await postCrmWebhook(store, owner, payload);
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body.event).toBe("quote.generated");
    expect(body.quote_url).toContain("outputs");
  });
});
