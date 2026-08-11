# Phase 8 Resident Advisor feasibility spike

## Decision

Classify Resident Advisor as **`manual/supporting only`** for Sound City's
scheduled-refresh workflow.

RA's public Chicago collection and event pages expose useful event information
to people and standard search engines. They do not expose a compliant,
server-fetchable production contract to Sound City. Direct unauthenticated
requests from the spike received a DataDome/Cloudflare `403` JavaScript
challenge for the Chicago collection and every directly fetched event page.
RA's current
[Terms of Use](https://ra.co/terms), sections 4.4(a) and 4.4(f), also prohibit
the automated extraction and unapproved scripted access that a scheduled parser
would require.

This result creates **no scheduled Phase 9 parser work**. A production-parser
estimate and proposed scope are not applicable because the spike did not reach
`viable`.

## Time box and boundaries

- Date: August 11, 2026, America/Chicago.
- Hard cap: approximately 30 minutes, shortened from the plan's one-working-day
  maximum at the product owner's request. Research stopped once both the access
  and compliance gates were resolved.
- Sources: RA's public Chicago event collection, representative public event
  pages, `robots.txt`, sitemap navigation, current Terms of Use, and RA's own
  historical announcement of regional event RSS feeds.
- Access test: a few direct HTTPS GETs with an identifying Sound City user
  agent. No account, authentication, browser automation, cookie jar, session
  reuse, CAPTCHA work, challenge replay, or anti-bot circumvention was used.
- No undocumented endpoint was requested. In particular, `/api` was not probed.

## Representative public Chicago samples

The [Chicago collection](https://ra.co/events/us/chicago) showed 184 upcoming
events in the August 11 search-indexed snapshot. Three current event pages were
inventoried across venue and listing shapes:

| Event | Public page fields | Shape covered |
| --- | --- | --- |
| [Chimeria Collective pres. Perunov Night](https://ra.co/events/2494734) | August 15, 20:00-05:00; TBA secret venue; promoter; lineup; genres; $15-30; 21+ | Underground event, withheld address, RA ticketing, mixed linked and plain-text artists |
| [Beach RITUALS After Glow feat. Sam Shure](https://ra.co/events/2506600) | August 15, 22:00-05:00; Spybar and address; promoters; lineup; genre; $25; 21+ | Named venue, RA ticketing, and external venue/ticket links |
| [Roni Size - Phantom 45 - Chrissy Tee](https://ra.co/events/2485900) | August 14, 22:00-04:00; smartbar and address; promoter; lineup; genres; $20-25; 21+ | Named venue, external ticket link, and event detail embedded in description |

These samples demonstrate that the human-facing pages contain enough core
fields to support manual review. They do not establish that those fields are
available to an authorized server client or backed by a stable machine-readable
contract.

## Candidate structured-data paths

| Path | Evidence | Assessment |
| --- | --- | --- |
| Chicago collection page | The public page provides event links, titles, dates, and venue labels. | Human/search discovery only. Sound City's direct GET received a challenge instead of the collection. |
| Individual `/events/{numeric-id}` pages | Search-indexed official pages expose title, local date/time, venue, lineup, genres, optional price/age, and canonical numeric URLs. | Best manual evidence surface, but **manual/supporting only**: direct server GETs were challenged and the required automated use is not permitted by RA's current terms. |
| Historical regional event RSS | RA's official [2008 RSS announcement](https://ra.co/news/9078) advertised per-region event feeds. Its linked regional feed route now redirects to the RA homepage, while the linked RSS directory routes return `404`. | Retired; not a current source contract. |
| Public sitemap and `robots.txt` | `robots.txt` is server-fetchable and advertises a sitemap, while explicitly disallowing `/api` and `/widget`. | Discovery metadata only; it supplies no event record contract and does not grant permission for automated reuse. |
| Undocumented APIs or embedded application state | None tested. `/api` is disallowed by `robots.txt`, and no current public event API was advertised in the reviewed official material. | Ineligible for a production-ready classification. |
| Written agreement or authorized partner feed | The current terms explicitly contemplate automated extraction only under a written agreement. | The only plausible future path to `viable`; no such access was available during this spike. |

## Server-side access evidence

All event-content requests used a single identifying user agent, followed
redirects, and had a 20-second timeout. No request was retried.

| Request | Result |
| --- | --- |
| `GET https://ra.co/events/us/chicago` | `403 text/html`, 768 bytes, zero redirects; DataDome/Cloudflare challenge requiring JavaScript |
| `GET https://ra.co/events/2481356` — More Bass Anniversary at Bourbon On Division, Chicago | Same `403` challenge response shape |
| `GET https://ra.co/events/2497054` — ascend: after hours at TBA - West Town, Chicago | Same `403` challenge response shape |
| `GET https://ra.co/events/2467312` — Rival Consoles at Lincoln Hall, Chicago | Same `403` challenge response shape |
| `GET https://ra.co/robots.txt` | `200 text/plain`, 1,164 bytes, zero redirects |

The challenge set a DataDome cookie and referenced a CAPTCHA-delivery script.
Neither was used. The test stopped rather than changing user agents, replaying
cookies, running JavaScript, or attempting any bypass.

The official, search-indexed versions of those three probe pages cover a named
venue, a TBA Chicago venue, RA ticketing, external promotional links, and
multiple lineup/genre shapes. The access result was identical across them.

Representative diagnostic command:

```sh
curl -sS -L --max-time 20 \
  -A 'SoundCityFeasibilitySpike/1.0 (+https://github.com/msmele345/sound-city)' \
  -D /tmp/sound-city-ra-chicago.headers \
  -o /tmp/sound-city-ra-chicago.html \
  https://ra.co/events/us/chicago
```

Standard search engines could index the public page content, but RA's Terms of
Use distinguish standard search-engine technology from unapproved automated
clients. Search visibility therefore does not make the path usable by Sound
City.

## Parser-contract field mapping

This is a hypothetical mapping for evaluating manual evidence and technical
fit only. It does not authorize implementation.

| Sound City field | Public RA page source | Mapping and constraint |
| --- | --- | --- |
| `sourceEventKey` | Numeric identifier in `/events/{id}` | Prefer the RA event identifier only if a future authorized contract guarantees it; otherwise use the canonicalized event URL. Stability and retention were not certified. |
| `matchFingerprint` | Title, local start, venue | Derive with the existing title/start/venue policy after resolving the local time safely. |
| `title` | Page heading | Direct. |
| `startsAt` / `endsAt` | Displayed date and time range | Pages display local wall time without an explicit offset in the reviewed surface. Apply `America/Chicago` only after confirming the listing is a Chicago event, and roll overnight end times to the next day. |
| `venueName` | Venue section | Direct when named. TBA/secret listings may intentionally omit an address and must not be guessed. |
| `lineup` / artists | Lineup section | Preserve linked and plain-text names in page order; do not infer performers from the title or prose. |
| `canonicalUrl` | `/events/{id}` page URL | Canonicalize the HTTPS URL and discard tracking parameters. |
| `ticketUrl` | RA Tickets or promotional-links section | Optional. RA and third-party ticket links vary by event. |
| `price` | Cost section | Optional free text; absent on some events. |
| `agePolicy` | Minimum-age section | Optional; normalize values such as `21+` without guessing when absent. |
| `styles` | Genre(s) section | Normalize through the existing style-tag policy. |
| Cancellation signal | Not observed | No mapping is certified. Do not treat disappearance from a collection as cancellation. |
| Supporting evidence | Canonical URL and compact field excerpts | Keep only bounded evidence under the existing review-first policy; do not retain a full RA response body. |

## Access and stability constraints

- The decisive compliance constraint is RA's current Terms of Use. Sections
  4.4(a) and 4.4(f) prohibit the automated extraction and unapproved scripted
  access needed for scheduled ingestion; section 7.2 limits reuse of site
  content. This product classification is not legal advice.
- Public event routes are protected by DataDome/Cloudflare in the tested server
  environment. The response explicitly requires JavaScript and points to a
  CAPTCHA-delivery host, which is outside the allowed parser boundary.
- The origin event HTML was never received, so the spike cannot certify JSON-LD,
  embedded application state, response validators, pagination, cancellation,
  retention, or normalized timestamp behavior.
- The numeric event URL and visible field layout are promising manual signals,
  but a search snapshot is not longitudinal proof of an ingestion contract.
- The once-advertised regional event RSS path is no longer available. No current
  official RSS, ICS, or public event API was found in the time box.
- `robots.txt` accessibility and search-engine indexing are operational signals,
  not authorization for Sound City's scheduled use.

## Exit condition and future re-spike

The spike exits as **`manual/supporting only`**. No source target, production
parser, fixture, estimate, or scheduled Phase 9 task follows from this result.

A future re-spike may reconsider `viable` only if RA provides written permission
and a stable authorized feed or partner interface. At that point, verify
representative Chicago inventory over time, identity and pagination semantics,
time zones, cancellations, retention, rate limits, and terms before proposing a
separate TDD parser scope and estimate.
