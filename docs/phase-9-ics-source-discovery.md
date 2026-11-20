# Phase 9 ICS source discovery

## Current decision

Replace Greenline with The Vinyl Collectiv as the selected Phase 9 ICS source:

- Organizer page: <https://luma.com/user/vinylcollectiv>
- Subscription feed: <https://api.lu.ma/ics/get?entity=calendar&id=cal-h8F4UvqlCzCPatc>
- Publisher: The Vinyl Collectiv, operated by Virginia Shipp
- Parser strategy: `venue-calendar`
- Initial cadence: `manual`

The product owner approved replacing Greenline on August 12, 2026 after its
calendar remained inactive. The replacement research found The Vinyl Collectiv
to be the best current fit: it is organizer-owned, publicly fetchable,
subscription-oriented, Chicago-focused, stable across repeated fetches, and has
upcoming DJ and vinyl-community inventory. See the detailed
[replacement report](./phase-9-ics-source-replacement.md).

The source is broader than a house- or techno-only promoter. Its history
includes Chicago house and electronic-music programming, but the upcoming item
does not name a genre. The first production manual run must therefore confirm
that it creates useful in-scope review work before any cadence promotion.

## Replacement qualification evidence

Live validation on August 12 returned `200 text/calendar; charset=utf-8` without
authentication. The feed contains 16 `VEVENT`s with stable UIDs, material
fields, Chicago locations, and canonical Luma event URLs in `DESCRIPTION`. Two
fetches produced the same material hash after excluding only provider-generated
`DTSTAMP` and `SEQUENCE` values.

One item was upcoming at validation time: [Bring a Record, Catch a Vibe:
One-Year Anniversary Edition](https://luma.com/jn6gvemj), August 13, 2026 from
7–9 p.m. CT at Marc Nolan in Chicago. The organizer's history includes recurring
DJ and open-decks programming, including [a Jamie 3:26
edition](https://luma.com/ric1zksj) whose event page identifies him with
Chicago's house scene.

The sanitized capture is
`src/server/refresh/__tests__/fixtures/vinyl-collectiv-luma.ics`. It retains all
16 UIDs and material event fields while omitting provider timestamps, sequence
numbers, status, coordinates, and organizer contact metadata. Parser, adapter,
and `runManualRefresh` integration tests cover the selected source, canonical
URL fallback, and unchanged-repeat suppression.

## Production certification status

The replacement has not been enrolled in production. A read-only request using
the configured local Admin credential still returned `401` on August 12, so no
production target was created, no manual refresh was triggered, and no cadence
was changed.

When valid Admin access is available:

1. Create The Vinyl Collectiv owner and target at `manual` cadence.
2. Run the target through two consecutive manual refreshes.
3. Confirm the first run creates useful in-scope review work.
4. Confirm the immediate repeat is `unchanged` and creates zero new review
   items.
5. Keep all targets manual until the one-source-at-a-time promotion gate is
   deliberately exercised.

## Superseded Greenline decision

Greenline's organizer-owned Luma calendar was originally selected on August 5,
2026:

- Calendar page: <https://luma.com/greenline>
- Subscription feed: <https://api.lu.ma/ics/get?entity=calendar&id=cal-WBFN4Ar4zrbkCZM>

It originally qualified as a public, stable, Chicago-based rave calendar with
13 events covering hard techno, hard groove, juke, and hard dance. Its fixture
also exposed the generic parser need to use the first description URL when an
ICS `URL` property is absent.

By August 7, and again on August 11, the live feed's newest event began June 20,
2026. With no upcoming useful inventory, Greenline could not satisfy the live
manual-certification gate. The source-specific fixture was retired when The
Vinyl Collectiv replaced it; the generic URL-fallback behavior remains covered
by the new Luma fixture.

## Candidates not selected

| Candidate | Result | Reason |
| --- | --- | --- |
| Museum of House | Reserve | Official and house-specific with one upcoming item, but the current subscription has only one event and does not meet the multi-event preference. |
| GOS Calendar | Rejected | Public 12-event subscription, but no events occur after June 13, 2026 and the catalog mixes art and music. |
| The Whistler | Rejected | Official and relevant, but its visible ICS links are per-event exports rather than a multi-event subscription. |
| The Monolith Project | Rejected | Official, active house-music organizer with upcoming dates, but no public ICS subscription was found. |
| Chicago Electronic Music Conference | Reserve only | Official and relevant, but its previously discovered calendar had no upcoming inventory. |
| Luma's Chicago city calendar | Rejected | Broad third-party aggregation would introduce unrelated inventory and is not the official publisher of listed music events. |

No irrelevant city calendar, HTML scrape, or per-event ICS download was selected
solely to satisfy protocol coverage.
