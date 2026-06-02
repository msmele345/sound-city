import { NextRequest } from "next/server";

import { DELETE, GET, PATCH, POST } from "./route";

function requestFor(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(new URL(path, "http://localhost:3000"), init);
}

describe("admin catalog route handlers", () => {
  const originalAdminSecret = process.env.ADMIN_SECRET;

  afterEach(() => {
    if (originalAdminSecret) {
      process.env.ADMIN_SECRET = originalAdminSecret;
    } else {
      delete process.env.ADMIN_SECRET;
    }
  });

  it("requires the configured admin secret before serving catalog maintenance routes", async () => {
    process.env.ADMIN_SECRET = "phase-seven-secret";

    const blockedResponse = await GET(
      requestFor("/api/admin/catalog?city=chicago"),
    );

    expect(blockedResponse.status).toBe(401);
    expect(await blockedResponse.json()).toMatchObject({
      error: expect.stringMatching(/admin secret/i),
    });

    const allowedResponse = await GET(
      requestFor("/api/admin/catalog?city=chicago", {
        headers: {
          "x-sound-city-admin-secret": "phase-seven-secret",
        },
      }),
    );

    expect(allowedResponse.status).toBe(200);
    expect(await allowedResponse.json()).toMatchObject({
      events: expect.any(Array),
      sources: expect.any(Array),
    });
  });

  it("creates, edits, and deletes venue records with source provenance", async () => {
    const createResponse = await POST(
      requestFor("/api/admin/catalog", {
        method: "POST",
        body: JSON.stringify({
          entity: "venue",
          input: {
            citySlug: "chicago",
            name: "Admin Loft",
            slug: "admin-loft",
            neighborhood: "Pilsen",
            address: "123 Admin Ave, Chicago, IL",
            capacity: 180,
            source: {
              title: "Admin Loft official calendar",
              url: "https://example.com/admin-loft",
              lastVerifiedAt: "2026-05-19",
            },
          },
        }),
      }),
    );
    const createdBody = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createdBody.venue).toMatchObject({
      name: "Admin Loft",
      source: {
        url: "https://example.com/admin-loft",
        lastVerifiedAt: "2026-05-19",
      },
    });

    const updateResponse = await PATCH(
      requestFor("/api/admin/catalog", {
        method: "PATCH",
        body: JSON.stringify({
          entity: "venue",
          id: createdBody.venue.id,
          input: {
            neighborhood: "Lower West Side",
            capacity: 220,
          },
        }),
      }),
    );
    const updatedBody = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updatedBody.venue).toMatchObject({
      neighborhood: "Lower West Side",
      capacity: 220,
    });

    const deleteResponse = await DELETE(
      requestFor("/api/admin/catalog", {
        method: "DELETE",
        body: JSON.stringify({
          entity: "venue",
          id: createdBody.venue.id,
        }),
      }),
    );

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ ok: true });
  });

  it("creates artist links and venue signals with validation errors for bad source URLs", async () => {
    const invalidResponse = await POST(
      requestFor("/api/admin/catalog", {
        method: "POST",
        body: JSON.stringify({
          entity: "artistLink",
          input: {
            artistSlug: "posthuman",
            kind: "soundcloud",
            label: "Broken source",
            url: "https://soundcloud.com/posthuman",
            source: {
              title: "Broken source",
              url: "not-a-url",
              lastVerifiedAt: "2026-05-19",
            },
          },
        }),
      }),
    );

    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toMatchObject({
      error: expect.stringMatching(/valid url/i),
    });

    const linkResponse = await POST(
      requestFor("/api/admin/catalog", {
        method: "POST",
        body: JSON.stringify({
          entity: "artistLink",
          input: {
            artistSlug: "posthuman",
            kind: "soundcloud",
            label: "Posthuman SoundCloud",
            url: "https://soundcloud.com/posthuman",
            source: {
              title: "Posthuman SoundCloud",
              url: "https://soundcloud.com/posthuman",
              lastVerifiedAt: "2026-05-19",
            },
          },
        }),
      }),
    );
    const linkBody = await linkResponse.json();

    expect(linkResponse.status).toBe(201);
    expect(linkBody.artistLink).toMatchObject({
      artistSlug: "posthuman",
      kind: "soundcloud",
      source: { title: "Posthuman SoundCloud" },
    });

    const signalResponse = await POST(
      requestFor("/api/admin/catalog", {
        method: "POST",
        body: JSON.stringify({
          entity: "venueSignal",
          input: {
            venueSlug: "smartbar",
            category: "door",
            value: "Advance tickets recommended for basement nights.",
            source: {
              title: "smartbar policy page",
              url: "https://example.com/smartbar-door",
              lastVerifiedAt: "2026-05-19",
            },
          },
        }),
      }),
    );
    const signalBody = await signalResponse.json();

    expect(signalResponse.status).toBe(201);
    expect(signalBody.venueSignal).toMatchObject({
      venueSlug: "smartbar",
      category: "door",
      source: { url: "https://example.com/smartbar-door" },
    });
  });

  it("returns admin lists for quick scanning", async () => {
    const response = await GET(requestFor("/api/admin/catalog?city=chicago"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.venues.length).toBeGreaterThan(0);
    expect(body.artists.length).toBeGreaterThan(0);
    expect(body.events.length).toBeGreaterThan(0);
    expect(body.sources.length).toBeGreaterThan(0);
  });
});
