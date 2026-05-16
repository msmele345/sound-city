# Sound-City PRD

## Problem Statement

Chicago has a deep house and techno scene, but discovery is fragmented across venue calendars, Resident Advisor, ticketing pages, promoter announcements, social posts, and public underground listings. People who want to find niche, underground, or lesser-known events often need to already know the right venues, promoters, or artists.

Sound-City should make it easier for local listeners and visitors to find Chicago house and techno events, including smaller and underground events that are not obvious from mainstream event calendars.

## Solution

Sound-City is a local music finder for large urban areas, starting with Chicago. It will provide a dark, vibrant web application focused on house and techno discovery. The primary experience is a personalized recommendation system that helps users find events, venues, and artists they may not have heard of before.

The app will launch with real, manually verified Chicago data from public sources. It will show event feeds, venue details, artist listening links, and weekly artist showcases, with lightweight Admin CRUD screens for maintaining curated catalog records. Because v1 has no user authentication, personalization will be stored locally in the user's browser through explicit preferences and actions.

## User Stories

1. As a house and techno fan, I want to see the latest events happening in Chicago, so that I can quickly find something to attend.
2. As a listener interested in underground music, I want recommendations that surface lesser-known events, so that I can discover parties outside the obvious mainstream listings.
3. As a user without an account, I want to set my music preferences locally, so that I can get personalized recommendations without signing up.
4. As a user, I want to tune my taste profile by style, vibe, venue size, start time, and discovery level, so that recommendations match how I actually go out.
5. As a user, I want to save events, so that I can come back to them later.
6. As a user, I want to dismiss events, so that the app learns what I am not interested in.
7. As a user, I want to mark events as attended, so that future recommendations can reflect my history.
8. As a user, I want to see why an event is recommended, so that I can understand the match and trust the result.
9. As a user, I want to browse a feed of upcoming events, so that I can compare dates, venues, artists, and styles.
10. As a user, I want event cards to show source links and last verified dates, so that I can confirm the event is real and current.
11. As a user, I want to discover artists playing upcoming Chicago events, so that I can decide whether the event fits my taste.
12. As a user, I want curated YouTube, SoundCloud, Bandcamp, or official links for artists, so that I can listen before attending.
13. As a user, I want a weekly artist showcase, so that I can learn about one highlighted house or techno artist in more depth.
14. As a user, I want the artist showcase to include music links and upcoming shows, so that I can explore and act from the same view.
15. As a user, I want a venue directory, so that I can understand which Chicago venues regularly host house and techno events.
16. As a user, I want venue pages or panels to show upcoming events, so that I can follow spaces I like.
17. As a user, I want curated venue signals like sound, crowd, door, room size, and layout, so that I can decide whether a venue fits my night.
18. As a user, I want venue locations and neighborhoods, so that I can plan where to go.
19. As a user, I want the interface to feel like Chicago underground club culture, so that the product feels specific rather than generic.
20. As a mobile user, I want the app to be usable on my phone, so that I can check events while I am out.
21. As a desktop user, I want a dense dashboard layout, so that I can scan recommendations, events, artists, and venues efficiently.
22. As a future maintainer, I want city-aware data models, so that the app can expand beyond Chicago later.
23. As an admin, I want CRUD screens for cities, venues, artists, events, artist links, venue signals, and source metadata, so that launch data can be maintained without editing seed files directly.
24. As an admin, I want validation and review-friendly forms, so that event, venue, artist, and source records stay consistent and trustworthy.
25. As a future maintainer, I want a manual data refresh workflow, so that real event data can be kept current before automated ingestion exists.
26. As a future maintainer, I want typed database schema and migrations, so that data changes are controlled and reviewable.

## Implementation Decisions

- Build the app as a Next.js, React 19, TypeScript, and Tailwind application.
- Deploy on Vercel.
- Use Next.js route handlers and server-side code on Vercel for backend API endpoints instead of Express or Spring Boot in v1.
- Use Neon Postgres as the database.
- Use Drizzle ORM for schema, migrations, and typed database access.
- Keep the v1 UI focused on Chicago, while designing the data model and API around cities.
- Do not include authentication in v1.
- Store personalization data in browser local storage.
- Include lightweight Admin CRUD screens in v1 for maintaining curated launch data.
- Use explicit user actions as recommendation signals: save, dismiss, and attended.
- Make the recommendation system discovery-first, prioritizing lesser-known events, smaller venues, unfamiliar artists, and strong taste matches.
- Use curated artist listening links rather than third-party embeds or generated search links.
- Use curated venue review signals rather than public anonymous reviews.
- Seed v1 with real Chicago data from verified public sources.
- Store source URL and last verified timestamp for every real event, artist, and venue record where applicable.
- Include a documented manual refresh process for keeping event data current.

## Testing Decisions

- Tests should verify external behavior and user-visible outcomes rather than internal implementation details.
- Recommendation scoring should be covered by unit tests, including taste preference matches, saves, dismissals, attended history, and discovery weighting.
- Next.js route handlers should be covered by integration tests against seeded test data.
- Admin CRUD workflows should be covered for creating, editing, validating, and deleting core catalog records.
- UI flows should be covered for browsing events, tuning taste preferences, saving and dismissing events, viewing artist links, and browsing venues.
- Responsive layout should be verified for mobile and desktop viewports.
- Build and type checks should run before deployment.

## Out of Scope

- User authentication.
- User accounts or cross-device sync.
- Automated scraping or scheduled ingestion.
- Public anonymous venue or event reviews.
- Public user-generated event submissions.
- Multi-city UI.
- Native mobile applications.
- In-app music playback embeds.

## Further Notes

The first version should prioritize recommendation quality, real Chicago data quality, and a strong visual identity. The app should feel like a practical discovery tool, not a marketing landing page. The primary screen should be the working product experience: recommendations, latest events, weekly artist showcase, and venue discovery.
