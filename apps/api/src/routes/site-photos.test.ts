import { describe, expect, it } from "vitest";
import { buildTestApp } from "../test/build-app";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLxVQAAAABJRU5ErkJggg==",
  "base64",
);

const UUID = "00000000-0000-0000-0000-000000000000";
const ISO = "2026-08-18T00:00:00.000Z";

/** Minimal multipart/form-data body for app.inject. */
function multipartBody(
  fields: Record<string, string>,
  file: { name: string; mime: string; data: Buffer },
): { payload: Buffer; contentType: string } {
  const boundary = "----wsboundary42";
  const parts: Buffer[] = [];
  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.mime}\r\n\r\n`,
    ),
  );
  parts.push(file.data);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function seededProject() {
  const { app, store } = await buildTestApp();
  const create = await app.inject({
    method: "POST",
    url: "/projects/",
    payload: { address: "1 Site Photo St, Richmond VIC 3121" },
  });
  const projectId = (create.json() as { project: { id: string } }).project.id;
  const survey = await app.inject({
    method: "POST",
    url: `/projects/${projectId}/survey`,
    payload: {},
  });
  expect(survey.statusCode).toBe(201);
  return { app, store, projectId };
}

describe("API — site-photos gallery", () => {
  it("lists an empty gallery", async () => {
    const { app, projectId } = await seededProject();
    const res = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/site-photos`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ photos: [] });
  });

  it("requires a survey before upload", async () => {
    const { app } = await buildTestApp();
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "2 Site Photo St, Richmond VIC 3121" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;
    const body = multipartBody(
      { natural_aspect: "1.5", name: "Rear fence" },
      { name: "rear.png", mime: "image/png", data: PNG_1PX },
    );
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/site-photos/upload`,
      headers: { "content-type": body.contentType },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(409);
  });

  it("uploads a photo, lists it, and serves it via the protected route", async () => {
    const { app, projectId } = await seededProject();
    const body = multipartBody(
      { natural_aspect: "1.5", name: "Rear fence" },
      { name: "rear.png", mime: "image/png", data: PNG_1PX },
    );
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/site-photos/upload`,
      headers: { "content-type": body.contentType },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(201);
    const { photo } = res.json() as {
      photo: { id: string; uri: string; name: string; natural_aspect: number };
    };
    expect(photo.name).toBe("Rear fence");
    expect(photo.natural_aspect).toBe(1.5);
    expect(photo.uri).toMatch(/\/photos\/[0-9a-f-]+\.png$/);

    const list = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/site-photos`,
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as { photos: unknown[] }).photos).toHaveLength(1);

    // The file itself is served by the protected-files route.
    const filename = photo.uri.split("/photos/")[1];
    const file = await app.inject({ method: "GET", url: `/photos/${filename}` });
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toContain("image/png");
  });

  it("rejects a missing or non-positive natural_aspect", async () => {
    const { app, projectId } = await seededProject();
    const body = multipartBody(
      {},
      { name: "rear.png", mime: "image/png", data: PNG_1PX },
    );
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/site-photos/upload`,
      headers: { "content-type": body.contentType },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects non-image uploads", async () => {
    const { app, projectId } = await seededProject();
    const body = multipartBody(
      { natural_aspect: "1" },
      { name: "notes.txt", mime: "text/plain", data: Buffer.from("hi") },
    );
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/site-photos/upload`,
      headers: { "content-type": body.contentType },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(415);
  });

  it("refuses to delete a photo pinned to a photo elevation", async () => {
    const { app, projectId } = await seededProject();
    const body = multipartBody(
      { natural_aspect: "1.5", name: "Rear fence" },
      { name: "rear.png", mime: "image/png", data: PNG_1PX },
    );
    const up = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/site-photos/upload`,
      headers: { "content-type": body.contentType },
      payload: body.payload,
    });
    expect(up.statusCode).toBe(201);
    const { photo } = up.json() as { photo: { id: string; uri: string } };

    const put = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/design-canvas`,
      payload: {
        placements: [],
        photo_elevations: [
          {
            id: UUID,
            photo_id: photo.id,
            name: "Rear fence elevation",
            uri: photo.uri,
            natural_aspect: 1.5,
            azimuth_deg: 180,
            calibration: null,
            strokes: [],
            created_at: ISO,
            updated_at: ISO,
          },
        ],
      },
    });
    expect(put.statusCode).toBe(200);

    const del = await app.inject({
      method: "DELETE",
      url: `/projects/${projectId}/site-photos/${photo.id}`,
    });
    expect(del.statusCode).toBe(409);
  });

  it("deletes a free photo and 404s on repeat", async () => {
    const { app, projectId } = await seededProject();
    const body = multipartBody(
      { natural_aspect: "1.5", name: "Front" },
      { name: "front.png", mime: "image/png", data: PNG_1PX },
    );
    const up = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/site-photos/upload`,
      headers: { "content-type": body.contentType },
      payload: body.payload,
    });
    const { photo } = up.json() as { photo: { id: string } };

    const del = await app.inject({
      method: "DELETE",
      url: `/projects/${projectId}/site-photos/${photo.id}`,
    });
    expect(del.statusCode).toBe(200);

    const again = await app.inject({
      method: "DELETE",
      url: `/projects/${projectId}/site-photos/${photo.id}`,
    });
    expect(again.statusCode).toBe(404);
  });
});
