import { NextResponse, type NextRequest } from "next/server";

import { getCatalogStore } from "@/server/catalog/catalog-store";
import {
  collectSources,
  createArtist,
  createArtistLink,
  createEvent,
  createVenue,
  createVenueSignal,
  deleteArtist,
  deleteArtistLink,
  deleteEvent,
  deleteVenue,
  deleteVenueSignal,
  updateArtist,
  updateArtistLink,
  updateEvent,
  updateVenue,
  updateVenueSignal,
} from "@/server/catalog/operations";
import type {
  CatalogSnapshot,
  CreateArtistInput,
  CreateArtistLinkInput,
  CreateEventInput,
  CreateVenueInput,
  CreateVenueSignalInput,
  UpdateArtistInput,
  UpdateArtistLinkInput,
  UpdateEventInput,
  UpdateVenueInput,
  UpdateVenueSignalInput,
} from "@/server/catalog/types";

type AdminEntity = "artist" | "artistLink" | "event" | "venue" | "venueSignal";

type AdminMutationBody = {
  entity?: AdminEntity;
  id?: string;
  input?: unknown;
};

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Admin request failed";
  return NextResponse.json({ error: message }, { status: 400 });
}

async function adminSnapshot(citySlug: string): Promise<CatalogSnapshot> {
  const store = getCatalogStore();
  const [cities, venues, artists, events] = await Promise.all([
    store.listCities(),
    store.listVenues(citySlug),
    store.listArtists(citySlug),
    store.listEvents(citySlug),
  ]);

  return { cities, venues, artists, events };
}

async function requestBody(request: NextRequest): Promise<AdminMutationBody> {
  return (await request.json()) as AdminMutationBody;
}

function requireEntity(entity: AdminMutationBody["entity"]): AdminEntity {
  if (!entity) {
    throw new Error("admin entity is required");
  }
  return entity;
}

function requireId(id: AdminMutationBody["id"]) {
  if (!id) {
    throw new Error("record id is required");
  }
  return id;
}

function requireInput<T>(input: unknown): T {
  if (!input || typeof input !== "object") {
    throw new Error("record input is required");
  }
  return input as T;
}

export async function GET(request: NextRequest) {
  const citySlug = request.nextUrl.searchParams.get("city") ?? "chicago";
  const snapshot = await adminSnapshot(citySlug);

  return NextResponse.json({
    ...snapshot,
    sources: collectSources(snapshot),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await requestBody(request);
    const store = getCatalogStore();

    switch (requireEntity(body.entity)) {
      case "venue": {
        const venue = await createVenue(
          store,
          requireInput<CreateVenueInput>(body.input),
        );
        return NextResponse.json({ venue }, { status: 201 });
      }
      case "artist": {
        const artist = await createArtist(
          store,
          requireInput<CreateArtistInput>(body.input),
        );
        return NextResponse.json({ artist }, { status: 201 });
      }
      case "event": {
        const event = await createEvent(
          store,
          requireInput<CreateEventInput>(body.input),
        );
        return NextResponse.json({ event }, { status: 201 });
      }
      case "artistLink": {
        const artistLink = await createArtistLink(
          store,
          requireInput<CreateArtistLinkInput>(body.input),
        );
        return NextResponse.json({ artistLink }, { status: 201 });
      }
      case "venueSignal": {
        const venueSignal = await createVenueSignal(
          store,
          requireInput<CreateVenueSignalInput>(body.input),
        );
        return NextResponse.json({ venueSignal }, { status: 201 });
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await requestBody(request);
    const store = getCatalogStore();
    const id = requireId(body.id);

    switch (requireEntity(body.entity)) {
      case "venue": {
        const venue = await updateVenue(
          store,
          id,
          requireInput<UpdateVenueInput>(body.input),
        );
        return NextResponse.json({ venue });
      }
      case "artist": {
        const artist = await updateArtist(
          store,
          id,
          requireInput<UpdateArtistInput>(body.input),
        );
        return NextResponse.json({ artist });
      }
      case "event": {
        const event = await updateEvent(
          store,
          id,
          requireInput<UpdateEventInput>(body.input),
        );
        return NextResponse.json({ event });
      }
      case "artistLink": {
        const artistLink = await updateArtistLink(
          store,
          id,
          requireInput<UpdateArtistLinkInput>(body.input),
        );
        return NextResponse.json({ artistLink });
      }
      case "venueSignal": {
        const venueSignal = await updateVenueSignal(
          store,
          id,
          requireInput<UpdateVenueSignalInput>(body.input),
        );
        return NextResponse.json({ venueSignal });
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await requestBody(request);
    const store = getCatalogStore();
    const id = requireId(body.id);

    switch (requireEntity(body.entity)) {
      case "venue":
        await deleteVenue(store, id);
        return NextResponse.json({ ok: true });
      case "artist":
        await deleteArtist(store, id);
        return NextResponse.json({ ok: true });
      case "event":
        await deleteEvent(store, id);
        return NextResponse.json({ ok: true });
      case "artistLink":
        await deleteArtistLink(store, id);
        return NextResponse.json({ ok: true });
      case "venueSignal":
        await deleteVenueSignal(store, id);
        return NextResponse.json({ ok: true });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
