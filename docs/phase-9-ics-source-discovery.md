# Phase 9 ICS source discovery

## Decision

Select Greenline's organizer-owned Luma calendar as the Phase 9 ICS source:

- Calendar page: <https://luma.com/greenline>
- Subscription feed: <https://api.lu.ma/ics/get?entity=calendar&id=cal-WBFN4Ar4zrbkCZM>
- Publisher: Greenline, a Chicago rave collective and radio series
- Parser strategy for later enrollment: `venue-calendar`
- Initial cadence for later enrollment: `manual`

This decision covers Phase 6 AC1-AC3 only. Fixture capture, parser changes,
source-target enrollment, and live manual certification remain AC5 and later.

## Time box

- Discovery window: August 5-6, 2026, with a hard stop at the end of the
  second working day.
- Selection completed: August 5, 2026, so the search closed early instead of
  consuming the remaining time box.
- Re-scope rule: if the selected feed stops qualifying before live
  certification, do not substitute an irrelevant or single-event feed. Resume
  the remaining discovery window, then use AC4's product-owner re-scope gate if
  no replacement qualifies.

## Qualification evidence

| Gate | Evidence |
| --- | --- |
| Official | The public calendar identifies Greenline as its publisher, describes the group as a rave collective, and is marked as a verified, public Luma calendar. This is the organizer's calendar, not a third-party city scrape. |
| Publicly fetchable | Two unauthenticated HTTPS requests on August 5 returned `200`, `Content-Type: text/calendar; charset=utf-8`, and the complete calendar. |
| Stable | Both requests returned the same 13 `VEVENT` UIDs, titles, start/end times, and locations. Only Luma-generated `DTSTAMP` and `SEQUENCE` telemetry changed. The feed declares `METHOD:PUBLISH`, `REFRESH-INTERVAL:PT12H`, and `X-PUBLISHED-TTL:PT12H`. |
| Chicago-based | The calendar metadata names Chicago, Illinois. All 13 published events have Chicago locations; the current feed spans June 2025 through June 2026. |
| Subscription-oriented | The calendar exposes an "Add iCal Subscription" action. Luma documents calendar subscriptions as live feeds containing all published events: <https://help.luma.com/p/ical-syncing>. The selected endpoint contains 13 events, rather than one event export. |
| Relevant | Greenline describes itself as a rave collective. Its published event material covers hard techno, hard groove, juke, hard dance, and related electronic styles; for example: <https://luma.com/b5cpkvd7>. |

The repository's existing `parseIcsDocument` interface parsed the live response
as 13 events with zero warnings. Stable UIDs, UTC start/end values, and Chicago
locations are already present. The feed places each canonical Luma event URL in
`DESCRIPTION` rather than a `URL` property; that is a fixture-driven parser gap
for AC6, not part of this discovery slice.

## Candidates not substituted

| Candidate | Result | Reason |
| --- | --- | --- |
| The Whistler | Rejected | It is an official, relevant Chicago venue, but its visible ICS links are per-event exports. Fetching the collection URL with `?format=ical` returned HTML, not a multi-event subscription. |
| The Monolith Project | Rejected | It is an official, active Chicago house-music organizer, but its published schedule does not expose a public ICS subscription. |
| Chicago Electronic Music Conference | Reserve only | Its Luma calendar is official, public, relevant, and subscription-oriented, but it currently contains three past conference/workshop events and no upcoming discovery inventory. |
| Zouk Chicago | Rejected | It offers a Chicago calendar subscription, but Brazilian zouk classes and socials are outside Sound City's house-and-techno scope. |
| Luma's Chicago city calendar | Rejected | It is a broad third-party city aggregation, not an official source for the listed music events, and would pollute the review queue with unrelated inventory. |

No irrelevant calendar, HTML scrape, or per-event ICS download was selected to
satisfy protocol coverage.

## Later certification guard

At discovery time, Greenline had no future event published after its June 19,
2026 event. Before AC8 can be certified, the live feed must contain at least one
upcoming, materially useful event. Historical drafts do not count as "useful
review work." If that gate is not met, follow the time-box and re-scope rule
above rather than weakening the acceptance criterion.
