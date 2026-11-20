# Phase 9 ICS source replacement

## Decision

Replace Greenline with **The Vinyl Collectiv** for Phase 9 certification:

- Organizer page: <https://luma.com/user/vinylcollectiv>
- Subscription feed: <https://api.lu.ma/ics/get?entity=calendar&id=cal-h8F4UvqlCzCPatc>
- Current upcoming event: <https://luma.com/jn6gvemj>
- Parser strategy: `venue-calendar`
- Initial cadence: `manual`

The Vinyl Collectiv is the best current fit because its organizer-owned feed is
public, stable, Chicago-focused, subscription-oriented, and has both a
multi-event history and upcoming inventory. It should replace Greenline in the
fixture and manual-certification steps before any daily-cadence promotion.

## Qualification evidence

Live validation was performed on August 12, 2026.

| Gate | Evidence |
| --- | --- |
| Official | The Luma profile is owned by Virginia Shipp under the `vinylcollectiv` username and describes a Chicago vinyl community. The feed's `ORGANIZER`, UIDs, and event links match that profile's hosted events. |
| Publicly fetchable | Two unauthenticated HTTPS requests returned `200` and `Content-Type: text/calendar; charset=utf-8`. No login, cookies, browser execution, or session state was required. |
| Stable | Both fetches contained the same 16 UIDs and identical material event fields after excluding provider-generated `DTSTAMP` and `SEQUENCE`. The feed declares `METHOD:PUBLISH`, `REFRESH-INTERVAL:PT12H`, and `X-PUBLISHED-TTL:PT12H`. |
| Chicago-based | All 16 records are Chicago events or use Chicago coordinates. The feed spans August 15, 2025 through August 13, 2026 local time. |
| Subscription-oriented | The feed contains 16 `VEVENT`s, not a single-event export. Luma documents calendar subscriptions as live feeds that are periodically fetched and include all published events on a calendar: <https://help.luma.com/p/ical-syncing>. |
| Upcoming inventory | One event is upcoming as of the validation date: “Bring a Record, Catch a Vibe: One-Year Anniversary Edition,” August 13, 2026 from 7–9 p.m. CT at Marc Nolan in Chicago: <https://luma.com/jn6gvemj>. |
| Stable identity and URLs | Every event has a stable Luma event UID and a canonical `https://luma.com/...` event URL in `DESCRIPTION`, which the existing ICS parser already supports. |
| Relevant | The organizer runs recurring vinyl-DJ and open-decks events around Chicago. Its history includes Jamie 3:26, whom its event page identifies as a Chicago house-scene DJ playing house, disco, and funk: <https://luma.com/ric1zksj>. A Chicago Electronic Music Conference event also describes The Vinyl Collectiv as highlighting vinyl DJs and building the local electronic-music community: <https://luma.com/872u6s5k>. |

### Relevance caveat

The Vinyl Collectiv is broader than a house- or techno-only promoter. Its
calendar centers vinyl listening, DJs, open decks, and community events, and
some records do not name a genre. That makes it a somewhat wider source than
Greenline, but not a protocol-only substitute: its documented programming
includes Chicago house and electronic music. Keep ingestion review-first and
confirm that the upcoming event creates useful in-scope review work during the
required first manual run. If it does not, do not promote it to daily cadence.

## Terms and unattended-access check

Luma itself exposes “Add iCal Subscription” as a public interface and documents
that calendar applications periodically fetch the live feed. Its Terms require
use of publicly supported interfaces and do not identify a separate prohibition
on periodically fetching this published subscription endpoint:
<https://luma.com/terms>. This is not a blanket right to republish Luma content;
Sound City's bounded metadata ingestion should remain review-first and use the
subscription endpoint rather than page scraping.

## Candidate comparison

| Candidate | Live result | Decision |
| --- | --- | --- |
| The Vinyl Collectiv | `200 text/calendar`; 16 events; 1 upcoming; two-fetch UID and material-field stability; canonical URLs for all events | **Selected.** Best combination of useful inventory, stability, Chicago ownership, and relevant DJ/house programming. |
| [The Museum of House](https://museumof.house/) | Its official site links to its [Luma calendar](https://luma.com/museumofhouse); feed `https://api.lu.ma/ics/get?entity=calendar&id=cal-mlS00FA6qjAk12J` returned `200 text/calendar`, 1 stable event, and 1 upcoming event | Reserve. It is the strongest house-specific publisher, but the current feed is a one-event calendar and does not satisfy the multi-event inventory preference. |
| [GOS Calendar](https://luma.com/GOS) | Feed `https://api.lu.ma/ics/get?entity=calendar&id=cal-7A20v4uzX0nb0BN` returned `200 text/calendar` and 12 events, but none occur after June 13, 2026 | Rejected for current certification because it has no upcoming inventory. Its catalog also mixes art and music events. |

## Certification handoff

1. Capture and sanitize the live Vinyl Collectiv feed as the replacement golden
   fixture, preserving its 16 UIDs and material fields.
2. Replace the named Greenline parser/engine certification with a named Vinyl
   Collectiv fixture and `runManualRefresh` integration test.
3. Configure the production target at `manual` cadence and run it twice. The
   first run must create useful review work; the immediate unchanged repeat
   must create zero new review items.
4. Promote it only after those gates pass, preserving the one-source-at-a-time
   Phase 9 rollout rule.

No production target, refresh run, fixture, test, or cadence was changed during
this research.
