## WHAT — Stack & Structure
- Project Name: Sound City
- Runtime: Node.js 22, npm 10.9.4 or higher
- Framework: React 19 / Next.js 
- DB: Neon Postgres vercel
- Key dirs: src/app/ (routes), src/components/
- CI/CD: Vercel for deployment

# Project Overview and Plan:
See @PRD.md to review project goals
See @plans/sound-city-mvp.md

## UI / Design language
The dashboard UI was redesigned (industrial-warehouse system) **after** the MVP
plan — it is not described in the plan. Before editing any UI code
(`src/components/`, `src/app/globals.css`, `src/app/layout.tsx`) or adding new
components, read @docs/ux-redesign.md for the design invariants, the
"do-not-reintroduce" list, and optional next steps.

# Run Commands:
- npm run dev
- npm test
- npm run build
- npx vercel --yes # for deploying current branch to vercel preview


## Cadences to follow:
1. TDD on any new feature code or bug fixes
2. Red green refactor. Reference the /tdd skill and follow it


# Git Strategy and Instructions
- Create feature branches off of develop for each new feature or task. Name branches using the format `feature/short-description` (e.g., `feature/spotify-integration`).
- Git Strategy is Git Flow with the following branches:
    - `main` - production ready code
    - `develop` - latest development code, merged from feature branches
    - `feature/*` - individual feature branches created from develop, merged back into develop when complete
    - `release/*` - created from develop when preparing for a release, merged into main
- PRs should be used to merge feature branches into develop, and release branches into main. PRs should be reviewed and approved by me before merging.
- Use Squash and Merge for all PRs to keep a clean commit history.
- Commit messages should follow best practices and use the format: (feat:, chore:, fix:, docs:, refactor:) Examples:
    - `feat: add new widget for genre breakdown`
    - `chore: minor tasks like updating dependencies or fixing typos`
    - `fix: resolve bug in Spotify API integration`
    - `docs: update README with setup instructions`
    - `refactor: service layer redesign`