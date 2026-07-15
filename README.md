# DING! MELBOURNE — Melbourne Tram Typing Game

**Play it here: https://shawn01ee.github.io/ding-melbourne/**

Type the current tram stop name, ring the bell (Enter/Space), and watch the tram
move to the next stop on a schematic route map. Five real Melbourne tram routes
(96, 86, 109, 58, 1) built from official Transport Victoria GTFS data, both
directions each. Modes: Full Route, 10-Stop Section, 60-second Sprint. Three
difficulties, synthesized tram sounds, a follow-camera that zooms to the tram so
long routes stay legible, local personal bests, no backend.

## Run

```bash
npm install
npm run dev       # local dev server
npm test          # 57 unit tests (normalization, scoring, state machine, data validation)
npm run build     # typecheck + production build
```

## Status

- ✅ Phase 0–1: deterministic state machine (CONFIG → COUNTDOWN → TYPING → READY →
  MOVING → FINISHED, plus PAUSED), per-character feedback, synthesized sounds,
  SVG route map with animated tram, localStorage personal bests.
- ✅ Phase 2: GTFS preprocessing pipeline ([scripts/gtfs/](scripts/gtfs/)) generating
  five real routes; route picker, Section mode, follow-camera.
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
The current build ships a small hand-made development fixture; coordinates and
stop numbers are approximate until the Phase 2 pipeline lands.

This is an independent fan-made project. It is not affiliated with, endorsed by,
or connected to Transport Victoria, the Department of Transport and Planning, or
Yarra Trams. All illustrations, sounds, and UI are original work.
