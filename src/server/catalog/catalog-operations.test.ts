import { createSeedCatalogStore } from "./catalog-store";
import {
  createArtist,
  createEvent,
  createVenue,
  deleteArtist,
  deleteEvent,
  deleteVenue,
  updateArtist,
  updateEvent,
  updateVenue,
} from "./operations";

describe("catalog server operations", () => {
  it("creates, updates, and deletes city-scoped venue records", async () => {
    const store = createSeedCatalogStore();

    const created = await createVenue(store, {
      citySlug: "chicago",
      name: "Test Loft",
      slug: "test-loft",
      neighborhood: "Pilsen",
      address: "123 Test Ave",
      capacity: 180,
      source: {
        title: "Test Loft official calendar",
        url: "https://example.com/test-loft",
        lastVerifiedAt: "2026-05-15",
      },
    });

    expect(created.name).toBe("Test Loft");

    const updated = await updateVenue(store, created.id, {
      capacity: 220,
      neighborhood: "Lower West Side",
    });

    expect(updated).toMatchObject({
      capacity: 220,
      neighborhood: "Lower West Side",
    });

    await deleteVenue(store, created.id);

    await expect(deleteVenue(store, created.id)).rejects.toThrow(
      /venue not found/i,
    );
  });

  it("creates artists and events with required source metadata", async () => {
    const store = createSeedCatalogStore();
    const artist = await createArtist(store, {
      citySlug: "chicago",
      name: "Test Selector",
      slug: "test-selector",
      styles: ["house"],
      source: {
        title: "Test Selector profile",
        url: "https://example.com/test-selector",
        lastVerifiedAt: "2026-05-15",
      },
    });

    const event = await createEvent(store, {
      citySlug: "chicago",
      title: "Test Night",
      slug: "test-night",
      startsAt: "2026-06-13T03:00:00.000Z",
      venueSlug: "smartbar",
      artistSlugs: [artist.slug],
      styles: ["house"],
      source: {
        title: "Test Night listing",
        url: "https://example.com/test-night",
        lastVerifiedAt: "2026-05-15",
      },
    });

    expect(event).toMatchObject({
      citySlug: "chicago",
      title: "Test Night",
      venue: expect.objectContaining({ slug: "smartbar" }),
      artists: [expect.objectContaining({ slug: artist.slug })],
      source: expect.objectContaining({
        url: "https://example.com/test-night",
      }),
    });

    const renamedArtist = await updateArtist(store, artist.id, {
      name: "Test Selector Revised",
    });
    expect(renamedArtist.name).toBe("Test Selector Revised");

    const movedEvent = await updateEvent(store, event.id, {
      venueSlug: "spybar",
      artistSlugs: [artist.slug],
    });
    expect(movedEvent.venue.slug).toBe("spybar");

    await deleteEvent(store, event.id);
    await deleteArtist(store, artist.id);

    await expect(deleteEvent(store, event.id)).rejects.toThrow(/event not found/i);
    await expect(deleteArtist(store, artist.id)).rejects.toThrow(
      /artist not found/i,
    );
  });
});
