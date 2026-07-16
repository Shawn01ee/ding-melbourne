Original prompt: 이런느낌으로 좀 해볼 수 없을까? 이번 수정은 너무 별론데 (reference: full-screen transit-map cockpit UI)

## Goal
- Redesign the game around a full-screen route map and bottom driving/typing console inspired by the supplied reference.
- Preserve the current multi-route, game-state, scoring, keyboard, and GTFS behavior.
- Build the visual directly in React/SVG/CSS; do not copy proprietary artwork.

## Status
- The worktree contains the current cockpit redesign plus the uninterrupted-input continuation; nothing was committed or deployed by Codex.
- Rebuilt setup as a two-column network-themed service selector.
- Rebuilt gameplay as a full-screen map with floating HUD, network backdrop, stop watermark, and cockpit console.
- Baseline and redesigned 1280×720 screenshots inspected; filled the empty first-stop previous panel and removed a muddy route-colour mix from the console bar.
- Wrong keys now count as misses without sticking; correct characters move the tram and completing a stop opens the next target immediately, with no READY/Enter/moving input lock.
- Replaced decorative in-game network strokes with the real shapes of the five currently bundled GTFS routes (1, 58, 86, 96, 109), projected in one geographic frame.
- Added a centered journey board, compact live stat pill, readable light/dark route-badge ink, and an original Melbourne tram-door result screen with share/retry/setup actions.
- Final verification: 64/64 unit tests pass, the production build and `git diff --check` pass, and Chromium end-to-end checks report zero console/page errors.
- Verified desktop 1280×720 and mobile 390×844 config/game/result screens. Mobile has no horizontal overflow; stats, hint, and typing capsule no longer overlap, and safe-area offsets are included.
- The supplied Taiwan ZIP was inspected only as a behavioral reference in a temporary directory; no code, artwork, or assets were copied into this project.

## TODO
- Import the remaining official Melbourne GTFS routes when expanding beyond the five currently bundled lines.
- Optional future polish: bundle a licensed webfont so typography is identical across operating systems.
- Optional future polish: add functional zoom controls only if the map interaction needs them; no decorative fake controls were added.
- Accounts, server-backed rankings, anti-cheat validation, and public-service deployment remain a later backend phase.

## Continuation: uninterrupted typing loop
- New request: use Densha Typing and the supplied Taiwan metro project only as behavioral references, without copying their code or visual assets.
- Baseline before this continuation: 62/62 tests and the production build pass.
- Primary behavior target: wrong keys count as misses but do not enter the text; completing a stop immediately opens the next stop; tram motion must never lock typing.
- Preserve DING! MELBOURNE's original Melbourne route data, synthesized audio, and visual identity.
- Completed and covered by reducer, shared-projection, route-colour contrast, build, and browser regression checks.

## Continuation: per-character combo and map-label clearance
- New request: increment combo on every correct character like the Japanese reference, and fix map stop labels that visually collide with the rail/station dot.
- Combo now carries across stop boundaries, resets on a wrong key/paste/backspace, and records max combo by character rather than by completed stop.
- The live map label is offset along the lower rail normal and both live/future label halos are reduced to 2.5px so the rail and station dot do not chew into the lettering.

## Continuation: Melbourne-inspired responsive audio
- Rebuilt the cue palette entirely with Web Audio oscillators and filtered noise; no external recordings or copied audio assets were introduced.
- Added distinct countdown relay clicks, a door-close/traction departure cue, progress-sensitive typing ticks, a rail-joint clack every four correct characters, restrained ten-combo chimes, and a brake-controller miss cue.
- Completing a stop now plays a brake wash, mechanical double bell, and pneumatic door release; completing the route adds a separate resolving final-stop cue.
- All rapid cues pass through one master compressor, and the AudioContext is primed from the start/toggle user gesture for reliable browser playback. Game progression never awaits audio.
- Verification: 64/64 unit tests and the production build pass. Chromium completed the shortest run with the expected cue sequence, one miss, normal/final arrivals, no console/page errors, and an empty cue log while muted.

## Continuation: cadence and platform audio variation
- Typing response now has slow, cruise, and fast traction profiles derived from the real interval between accepted keys; faster typing lifts and tightens the motor pulse instead of merely replaying one click.
- Four-character rail joints gain a second bogie clack every eight characters and a light overhead-wire tick every twelve, all kept under the existing compressor.
- Each stop gets one wheel-flange/brake approach cue when its target crosses 70%, while three deterministic arrival variants prevent every platform from sounding identical.
- Station audio is scheduled 55ms after the final key so the input response lands first without blocking immediate typing into the next stop.
- Reverified with 64/64 tests, production build, bundled Playwright input, full shortest-route cue instrumentation, muted playback, result-screen screenshot, and zero console/page errors.

## Continuation: heritage Melbourne tram result screen
- Replaced the Japanese-train-like paired green doors with an original tram-front composition inspired by Melbourne's heritage W-class visual language.
- Added a cream roof/body, Brunswick-green cab panels, gold pinstripe, dark destination rollsign, curved cab glazing, paired lamps, car-number plate, and lower tram apron; no official logos or copied tram artwork were used.
- Moved the route colour back to information hierarchy (route badge/status accent) instead of using it as the vehicle livery, so every line retains one coherent Melbourne tram shell.
- Repacked metrics into a 3×2 driver-instrument grid and actions into a compact 2-row layout on desktop. Mobile hides the decorative cab windows and keeps the rollsign, 2×3 metrics, and all three actions visible.
- Verification: 64/64 tests, production build, bundled input regression, desktop 1280×720 result capture, mobile 390×844 result capture, zero horizontal overflow, no internal mobile result scroll, and zero console/page errors.

## Continuation: complete current Melbourne tram network
- Downloaded the official Transport Victoria GTFS Schedule dated 2026-07-10 and regenerated the metropolitan tram branch from source; the raw 267.8 MB archive stayed in `/tmp` and is not part of the repository.
- Expanded from 5 to all 24 published routes: 1, 3, 5, 6, 11, 12, 16, 19, 30, 35, 48, 57, 58, 59, 64, 67, 70, 72, 75, 78, 82, 86, 96, 109.
- Updated the generator to support/default to `--routes all`, clean stale generated route files, and discover all generated JSON automatically at runtime.
- Relaxed the route contract from two directions to one-or-more so Route 35 City Circle is represented by its single official circular direction; all other current lines retain both published directions.
- Added a bounded scrollable 24-line picker with selected-line auto-scroll and maximum directional stop counts. Route 96 remains the first-visit default.
- Added registry regression tests for the exact route set, official source date, default line, and City Circle direction count. README and Phase 2 documentation now match the generated network.
- Verification: 68/68 unit tests, production build, bundled default-route play, desktop/mobile 24-line picker checks, Route 35 selection and typing, zero horizontal overflow, and zero console/page errors.

## Continuation: compact countdown layout
- Replaced the oversized free-standing two-digit countdown with a compact tram departure display containing `Departing in`, the number, and `Seconds`.
- Reduced the measured number height to about 76px at 1024×1024 and 68px at 390×844, while keeping route colour as the display accent.
- Normalized the first-stop card width, service-line spacing, counter spacing, and ESC hint across desktop, square, and mobile viewports.
- Verification: 68/68 tests, production build, bundled countdown capture, explicit 1024×1024 and 390×844 layout assertions, no overlap/scroll/overflow, and zero console/page errors.

## Continuation: two-level difficulty model
- Replaced the three player-facing choices with `Standard` and `Driver`.
- Standard now uses the former Easy target (the short stop name before `/`); Driver uses the former Standard target (the full intersection name without the stop number).
- Existing saved Easy settings migrate to Standard automatically, and unknown saved difficulty values fall back safely.
- Verification: 68/68 tests and production build pass. Bundled Playwright checks confirmed both modes reach gameplay, accept the first character, raise combo to 1, expose the expected target through `render_game_to_text`, and produce zero console/page errors.

## Continuation: Vercel production deployment
- Created the `ding-melbourne` Vercel project under the existing account; Vite was detected automatically with `npm run build` and `dist` output.
- Connected `Shawn01ee/ding-melbourne` so pushes to `main` receive production deployments and other branches can receive previews.
- Production URL: `https://ding-melbourne.vercel.app/`; the existing GitHub Pages deployment remains as a mirror.
- Verified the live Vercel build at desktop and mobile widths: all 24 routes load, Route 35 starts, Standard exposes the short target, a correct character raises combo, and no console/page errors occur.

## Continuation: controlled headline, night mode, and whole-network map
- Replaced automatic headline wrapping with four explicit typographic lines and a consistent baseline gap so the hero no longer reflows awkwardly across desktop widths.
- Added a persistent day/night theme across setup, countdown, gameplay, pause, and result screens; the live HUD also exposes the theme control on desktop.
- Added a full-screen geographic Melbourne tram overview generated from the bundled GTFS shapes. All 24 current route colours appear together, the selected route is emphasized, and its legend buttons select a route for play.
- Verification: 68/68 tests and production build pass. Bundled and custom Playwright runs confirmed 24 map lines/keys, route selection, saved night theme after reload, night gameplay input/combo, mobile 390px layout without horizontal overflow, and zero console/page errors.
