import type { CatalogSnapshot } from "./types";

const verifiedAt = "2026-05-15";

export const launchCatalogData: CatalogSnapshot = {
  cities: [
    {
      id: "city_chicago",
      name: "Chicago",
      slug: "chicago",
      timeZone: "America/Chicago",
    },
  ],
  venues: [
    {
      id: "venue_smartbar",
      citySlug: "chicago",
      name: "smartbar",
      slug: "smartbar",
      neighborhood: "Wrigleyville",
      address: "3730 N Clark St, Chicago, IL 60613",
      capacity: 400,
      source: {
        id: "source_smartbar_metro",
        title: "Metro Chicago smartbar venue page",
        url: "https://metrochicago.com/venue/smartbar/",
        lastVerifiedAt: verifiedAt,
      },
      signals: [
        {
          id: "signal_smartbar_sound",
          venueSlug: "smartbar",
          category: "sound",
          value: "Basement room with house and techno-focused programming.",
          source: {
            id: "source_smartbar_metro",
            title: "Metro Chicago smartbar venue page",
            url: "https://metrochicago.com/venue/smartbar/",
            lastVerifiedAt: verifiedAt,
          },
        },
      ],
    },
    {
      id: "venue_spybar",
      citySlug: "chicago",
      name: "Spybar",
      slug: "spybar",
      neighborhood: "River North",
      address: "646 N Franklin St, Chicago, IL 60654",
      capacity: 300,
      source: {
        id: "source_spybar_about",
        title: "Spybar Chicago about page",
        url: "https://www.spybarchicago.com/about",
        lastVerifiedAt: verifiedAt,
      },
      signals: [
        {
          id: "signal_spybar_room",
          venueSlug: "spybar",
          category: "room",
          value: "Underground club room built for close-quarters dance music.",
          source: {
            id: "source_spybar_about",
            title: "Spybar Chicago about page",
            url: "https://www.spybarchicago.com/about",
            lastVerifiedAt: verifiedAt,
          },
        },
      ],
    },
    {
      id: "venue_podlasie",
      citySlug: "chicago",
      name: "Podlasie Club",
      slug: "podlasie-club",
      neighborhood: "Avondale",
      address: "2918 N Central Park Ave, Chicago, IL 60618",
      capacity: 220,
      source: {
        id: "source_podlasie_about",
        title: "Podlasie Club about page",
        url: "https://www.podlasiechicago.com/about/",
        lastVerifiedAt: verifiedAt,
      },
      signals: [
        {
          id: "signal_podlasie_crowd",
          venueSlug: "podlasie-club",
          category: "crowd",
          value: "DJ-led weekend room with broad modern electronic programming.",
          source: {
            id: "source_podlasie_about",
            title: "Podlasie Club about page",
            url: "https://www.podlasiechicago.com/about/",
            lastVerifiedAt: verifiedAt,
          },
        },
      ],
    },
  ],
  artists: [
    {
      id: "artist_posthuman",
      citySlug: "chicago",
      name: "Posthuman",
      slug: "posthuman",
      bio: "Acid and techno act included in smartbar's May 2026 Family Matters listing.",
      styles: ["techno", "acid"],
      showcase: true,
      source: {
        id: "source_family_matters_ra",
        title: "Family Matters feat. Posthuman Resident Advisor listing",
        url: "https://pt.ra.co/events/2412925",
        lastVerifiedAt: verifiedAt,
      },
      links: [
        {
          id: "link_posthuman_ra",
          artistSlug: "posthuman",
          kind: "resident-advisor",
          label: "Resident Advisor event listing",
          url: "https://pt.ra.co/events/2412925",
          source: {
            id: "source_family_matters_ra",
            title: "Family Matters feat. Posthuman Resident Advisor listing",
            url: "https://pt.ra.co/events/2412925",
            lastVerifiedAt: verifiedAt,
          },
        },
      ],
    },
    {
      id: "artist_lemtom",
      citySlug: "chicago",
      name: "Lemtom",
      slug: "lemtom",
      bio: "House artist listed for a May 2026 Spybar event.",
      styles: ["house"],
      showcase: false,
      source: {
        id: "source_lemtom_ra",
        title: "Lemtom at Spybar Resident Advisor listing",
        url: "https://ra.co/events/2403087",
        lastVerifiedAt: verifiedAt,
      },
      links: [
        {
          id: "link_lemtom_ra",
          artistSlug: "lemtom",
          kind: "resident-advisor",
          label: "Resident Advisor event listing",
          url: "https://ra.co/events/2403087",
          source: {
            id: "source_lemtom_ra",
            title: "Lemtom at Spybar Resident Advisor listing",
            url: "https://ra.co/events/2403087",
            lastVerifiedAt: verifiedAt,
          },
        },
      ],
    },
    {
      id: "artist_jeremy_olander",
      citySlug: "chicago",
      name: "Jeremy Olander",
      slug: "jeremy-olander",
      bio: "Melodic house and techno artist listed for a Spybar open-to-close night.",
      styles: ["melodic house", "techno"],
      showcase: false,
      source: {
        id: "source_jeremy_olander_ra",
        title: "Jeremy Olander Open-to-Close Resident Advisor listing",
        url: "https://es.ra.co/events/2365013",
        lastVerifiedAt: verifiedAt,
      },
      links: [
        {
          id: "link_jeremy_olander_ra",
          artistSlug: "jeremy-olander",
          kind: "resident-advisor",
          label: "Resident Advisor event listing",
          url: "https://es.ra.co/events/2365013",
          source: {
            id: "source_jeremy_olander_ra",
            title: "Jeremy Olander Open-to-Close Resident Advisor listing",
            url: "https://es.ra.co/events/2365013",
            lastVerifiedAt: verifiedAt,
          },
        },
      ],
    },
  ],
  events: [],
};

const venueBySlug = new Map(
  launchCatalogData.venues.map((venue) => [venue.slug, venue]),
);
const artistBySlug = new Map(
  launchCatalogData.artists.map((artist) => [artist.slug, artist]),
);

launchCatalogData.events = [
  {
    id: "event_family_matters_posthuman",
    citySlug: "chicago",
    title: "Family Matters feat. Posthuman",
    slug: "family-matters-posthuman",
    startsAt: "2026-05-22T02:00:00.000Z",
    venue: venueBySlug.get("smartbar")!,
    artists: [artistBySlug.get("posthuman")!],
    styles: ["techno", "house"],
    source: {
      id: "source_family_matters_ra",
      title: "Family Matters feat. Posthuman Resident Advisor listing",
      url: "https://pt.ra.co/events/2412925",
      lastVerifiedAt: verifiedAt,
    },
  },
  {
    id: "event_lemtom_spybar",
    citySlug: "chicago",
    title: "Lemtom at Spybar",
    slug: "lemtom-spybar",
    startsAt: "2026-05-24T03:00:00.000Z",
    venue: venueBySlug.get("spybar")!,
    artists: [artistBySlug.get("lemtom")!],
    styles: ["house"],
    source: {
      id: "source_lemtom_ra",
      title: "Lemtom at Spybar Resident Advisor listing",
      url: "https://ra.co/events/2403087",
      lastVerifiedAt: verifiedAt,
    },
  },
  {
    id: "event_jeremy_olander_spybar",
    citySlug: "chicago",
    title: "Jeremy Olander Open-to-Close",
    slug: "jeremy-olander-open-to-close",
    startsAt: "2026-05-30T03:00:00.000Z",
    venue: venueBySlug.get("spybar")!,
    artists: [artistBySlug.get("jeremy-olander")!],
    styles: ["melodic house", "techno"],
    source: {
      id: "source_jeremy_olander_ra",
      title: "Jeremy Olander Open-to-Close Resident Advisor listing",
      url: "https://es.ra.co/events/2365013",
      lastVerifiedAt: verifiedAt,
    },
  },
];
