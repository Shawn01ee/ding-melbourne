# DING! MELBOURNE — Melbourne Tram Typing Game

**Play it here: https://shawn01ee.github.io/ding-melbourne/**

Type the current tram stop name, ring the bell (Enter/Space), and watch the tram
move to the next stop on a schematic Route 96 map. Milestone 1 build per the
AI-ready PRD (v0.1, 15 Jul 2026): 5-stop Route 96 fixture, Full Route + 60-second
Sprint, three difficulties, local personal bests, no backend.

## Run

```bash
npm install
npm run dev       # local dev server
npm test          # 57 unit tests (normalization, scoring, state machine, data validation)
npm run build     # typecheck + production build
```

## Status

- ✅ Phase 0–1: deterministic state machine (CONFIG → COUNTDOWN → TYPING → READY →
  MOVING → FINISHED, plus PAUSED), per-character feedback, synthesized bell,
  SVG route map with animated tram marker, localStorage personal bests.
- ⬜ Phase 2: GTFS preprocessing pipeline replacing `src/data/generated/route-96.json`.

See [docs/PLAN.md](docs/PLAN.md) for assumptions, contracts, the full transition
table, and open decisions.

## Data & attribution

Contains public transport data supplied by the Victorian Department of Transport
and Planning, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
(GTFS Schedule: https://opendata.transport.vic.gov.au/dataset/gtfs-schedule).
The current build ships a small hand-made development fixture; coordinates and
stop numbers are approximate until the Phase 2 pipeline lands.

This is an independent fan-made project. It is not affiliated with, endorsed by,
or connected to Transport Victoria, the Department of Transport and Planning, or
Yarra Trams. All illustrations, sounds, and UI are original work.
