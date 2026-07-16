# DING! MELBOURNE development progress

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
- Added a bounded scrollable 24-line picker with maximum directional stop counts. Lines are shown in numeric order and Route 1 is the first-visit default.
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

## Continuation: geographic network explorer
- Reworked the 24-line overview from a bare polyline diagram into a stylized Melbourne map with Port Phillip Bay coastline, the Yarra/Maribyrnong/Merri waterways, parkland, CBD street grid, compass, and major suburb labels.
- Route lines are now directly clickable. Selecting a line keeps the explorer open and switches to Route Focus instead of immediately closing the map.
- Route Focus dims the rest of the network, zooms to the selected GTFS shape, plots every stop, labels both termini, and runs a small animated tram along the line. All Lines returns to the complete city view; Drive This Line confirms the current selection.
- Kept the contextual geography original and schematic; no official map artwork or third-party map tiles were copied into the app.
- Verification: 68/68 tests and production build pass. The bundled game client and a multi-step Chromium check confirmed 24 clickable lines, 14 place labels, 3 waterways, 4 park areas, Route 19 focus with 34 stop markers and animated tram, All Lines return, Route 35 selection, night rendering, 390px mobile layout without overflow, and zero console/page errors.

## Continuation: tram brand mark, lazy routes, and Vercel-only production
- Replaced the Route 96-number favicon with an original Melbourne tram-front mark and reused the same mark in the setup lockup, countdown, and live HUD.
- Added a 40KB generated network index with ≤64 geographic points per route. The main app now eagerly loads only this catalog, while each validated route JSON is emitted as its own lazy chunk and fetched when selected.
- Initial main JavaScript fell from 236.7KB gzip to 76.7KB gzip; first visit fetches only the default route chunk. The build no longer emits the >500KB chunk warning.
- Replaced the GitHub Pages deployment workflow with a read-only CI workflow. `vercel.json` makes `npm run verify` (tests + typecheck + build) the Vercel production gate, and the Vercel URL is now canonical.
- Browser verification observed only Route 1 on first load and additional route chunks exactly when selected. The geographic explorer, animated focus, night persistence, character combo, and 390px mobile layout passed with zero console/page errors.

## Continuation: separated setup utilities
- Increased the spacing between Network Map and the day/night selector, and tightened their card shadows so the two controls no longer visually merge.
- Verification: 68/68 tests and production build pass. Playwright confirmed a 16px gap, zero overlap, zero horizontal overflow, working theme/map controls, and zero console/page errors at 1280px, 1024px, 768px, and 390px widths.

## Continuation: original passenger-information hub
- Added an eight-item service-information structure inspired by the completeness of the supplied reference, while keeping the visual language and copy specific to DING! MELBOURNE.
- Setup now links to How to Play, Typing Guide, FAQ, About, Accessibility, Privacy, Terms, and Data & Credits; each opens as a hash-addressable in-app document with day/night support and a persistent return to the game.
- Content describes only implemented behaviour and explicitly identifies absent accounts, cloud sync, advertising, analytics, live operations, and journey-planning guarantees.
- Browser checks cover desktop/mobile scrolling, direct hashes, all navigation items, back history, return to setup, night rendering, and zero horizontal overflow. Existing network-map selection and character-combo gameplay still pass without console/page errors.

## Continuation: forward-only tram geometry
- Audited every generated route/direction: the published GTFS shapes contained both single-vertex U-turn spikes and longer low-area out-and-back traces, including the Casino–Batman Park span and a long Route 1 southbound detour.
- The renderer removes those retraced sections while preserving geographic loops such as Route 35, then remaps source progress monotonically onto the cleaned rail.
- Added a complete 24-route/all-direction regression for both sharp reversals and multi-point retraces. Route order, the Route 1 default, and per-character driving through Casino–Batman Park were also checked in Chromium with zero console/page errors.

## Continuation: night result contrast
- Kept the heritage result panel on its light tram-cream surface in both themes, but scoped its inherited text to heritage deep green instead of the night theme's near-white page text.
- Added a dedicated dark neutral for journey-report metadata and the personal-best comparison so secondary text also remains readable.
- Chromium completed a two-stop Route 1 run in night mode with metric contrast measured at 12.89:1 and supporting text at 4.87:1, with zero console/page errors.
