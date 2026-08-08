import { test, expect } from "@playwright/test";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Settings — web UI routes were removed in 9a29992 (crew/rate-card/suppliers/
 * license pages deleted). Soft isVisible skips that greened empty shells are gone.
 *
 * Hard coverage today:
 * - Web /settings/* must 404 (surfaces intentionally absent)
 * - Crew add/remove via API (fail if endpoints break)
 * - Rate card / suppliers / license API still return meaningful payloads
 *
 * When web settings UI returns, replace the 404 asserts with form + Dialog flows.
 */
test.describe("Settings — web routes removed", () => {
  test("crew / rate-card / suppliers / license pages are gone", async ({
    page,
  }) => {
    for (const path of [
      "/settings/crew",
      "/settings/rate-card",
      "/settings/suppliers",
      "/settings/license",
    ]) {
      const res = await page.goto(path);
      expect(res, `navigation to ${path}`).toBeTruthy();
      expect(res!.status(), `${path} should 404`).toBe(404);
      await expect(page.getByText(/Page not found/i)).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});

test.describe("Settings — crew API (web form removed)", () => {
  test("crew add then remove must succeed (hard fail if API missing)", async ({
    request,
  }) => {
    const name = `E2E Crew ${Date.now()}`;
    const create = await request.post(`${API}/crew/`, {
      data: {
        name,
        role: "tradesperson",
        phone: "0400000000",
        hourly_rate: 65,
      },
    });
    expect(create.ok(), `POST /crew/ → ${create.status()}`).toBeTruthy();
    const created = (await create.json()) as {
      member: { id: string; name: string };
    };
    expect(created.member.name).toBe(name);
    expect(created.member.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const list = await request.get(`${API}/crew/`);
    expect(list.ok()).toBeTruthy();
    const listed = (await list.json()) as {
      crew: Array<{ id: string; name: string }>;
    };
    expect(listed.crew.some((m) => m.id === created.member.id)).toBeTruthy();

    const del = await request.delete(`${API}/crew/${created.member.id}`);
    expect(del.status(), "DELETE /crew/:id").toBe(204);

    const after = await request.get(`${API}/crew/`);
    expect(after.ok()).toBeTruthy();
    const afterBody = (await after.json()) as {
      crew: Array<{ id: string }>;
    };
    expect(afterBody.crew.some((m) => m.id === created.member.id)).toBeFalsy();
  });
});

test.describe("Settings — rate card / suppliers / license API", () => {
  test("rate card lists editable SKUs", async ({ request }) => {
    const res = await request.get(`${API}/settings/rate-card`);
    expect(res.ok(), `GET /settings/rate-card → ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as {
      items: Array<{ sku: string; rate: number }>;
      count: number;
    };
    expect(body.count).toBeGreaterThan(0);
    expect(body.items.length).toBe(body.count);
    const first = body.items[0]!;
    expect(first.sku.length).toBeGreaterThan(0);
    expect(typeof first.rate).toBe("number");

    const patch = await request.patch(
      `${API}/settings/rate-card/${encodeURIComponent(first.sku)}`,
      { data: { rate: first.rate } },
    );
    expect(patch.ok(), `PATCH rate-card/${first.sku}`).toBeTruthy();
    const patched = (await patch.json()) as { item: { sku: string; rate: number } };
    expect(patched.item.sku).toBe(first.sku);
    expect(patched.item.rate).toBe(first.rate);
  });

  test("suppliers list returns catalogue entries", async ({ request }) => {
    const res = await request.get(`${API}/suppliers/`);
    expect(res.ok(), `GET /suppliers/ → ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as { suppliers: unknown[] };
    expect(Array.isArray(body.suppliers)).toBeTruthy();
    expect(body.suppliers.length).toBeGreaterThan(0);
  });

  test("license endpoint returns workspace license payload", async ({
    request,
  }) => {
    const res = await request.get(`${API}/integrations/license`);
    expect(
      res.ok(),
      `GET /integrations/license → ${res.status()}`,
    ).toBeTruthy();
    const body = (await res.json()) as { license: Record<string, unknown> };
    expect(body.license).toBeTruthy();
    expect(typeof body.license).toBe("object");
  });
});
