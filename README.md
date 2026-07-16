# DING! MELBOURNE — Melbourne Tram Typing Game

**Play it here: https://ding-melbourne.vercel.app/**

Type each tram stop name and watch every correct character drive the tram along
the map; completing a stop opens the next target immediately. The game includes
all 24 metropolitan tram routes in the 10 July 2026 Transport Victoria GTFS
Schedule (both directions where published; Route 35 City Circle is circular).
Modes: Full Route, 10-Stop Section, 60-second Sprint. Standard and Driver
difficulties, responsive synthesized tram sounds, a follow-camera for long
lines, a day/night theme, a complete 24-route network overview, local personal
bests, installable app/offline support, no backend.

## Install as an app

- iPhone/iPad: open the site in Safari, tap **Share**, then **Add to Home Screen**.
- Android/desktop Chrome or Edge: use the browser's **Install app** action.

The installed version opens without browser chrome and caches the game shell plus
all 24 route files for repeat play offline. On phones, gameplay automatically
switches to a compact cockpit while the on-screen keyboard is visible.

## Run

```bash
npm install
npm run dev       # local dev server
npm test          # 76 unit tests (gameplay, viewport handling, data validation, route registry)
npm run build     # typecheck + production build
npm run verify    # test + typecheck + production build (CI/Vercel gate)
```

## Status

- ✅ Phase 0–1: deterministic state machine (CONFIG → COUNTDOWN → uninterrupted
  TYPING → FINISHED, plus PAUSED), per-character feedback, synthesized sounds,
  SVG route map with animated tram, localStorage personal bests.
- ✅ Phase 2: GTFS preprocessing pipeline ([scripts/gtfs/](scripts/gtfs/)) generating
  all 24 currently published tram routes; scrollable route picker, Section mode,
  follow-camera, a selectable geographic network explorer with route focus, and
  per-route lazy loading to keep the initial download small.
- ✅ Installable PWA: standalone home-screen mode, app icons, updateable service
  worker, offline replay, and a Visual Viewport-driven mobile keyboard layout.
- ⬜ Next: web font + branding polish, result sharing, then accounts + leaderboard
  (Supabase) with server-side score validation.

## Regenerating route data

Route JSON in `src/data/generated/` is produced from the official Transport
Victoria GTFS Schedule. See [scripts/gtfs/README.md](scripts/gtfs/README.md).

See [docs/PLAN.md](docs/PLAN.md) for assumptions, contracts, and the transition
table.

## Data & attribution

Contains public transport data supplied by the Victorian Department of Transport
and Planning, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
(GTFS Schedule: https://opendata.transport.vic.gov.au/dataset/gtfs-schedule).
The current generated route set is sourced from the official GTFS Schedule dated
10 July 2026. Run the documented pipeline to replace it when a newer weekly feed
is published.

This is an independent fan-made project. It is not affiliated with, endorsed by,
or connected to Transport Victoria, the Department of Transport and Planning, or
Yarra Trams. All illustrations, sounds, and UI are original work.
