# GTFS → route JSON pipeline

`build-routes.mjs` converts the official Transport Victoria GTFS Schedule into
the small per-route game JSON files in `src/data/generated/`. It runs at build
time only — the browser never downloads or parses the ~268 MB GTFS zip.

## Regenerate

1. Download the GTFS Schedule zip (CC BY 4.0):
   https://opendata.transport.vic.gov.au/dataset/gtfs-schedule

2. The zip nests one zip per transport mode branch. Extract the **metropolitan
   tram** branch (folder `3`) and then its inner `google_transit.zip`:

   ```bash
   unzip gtfs.zip '3/*' -d gtfs-extract
   unzip gtfs-extract/3/google_transit.zip -d tram
   ```

3. Generate every currently published metropolitan tram route (matched by
   `route_short_name`):

   ```bash
   node scripts/gtfs/build-routes.mjs \
     --gtfs /path/to/tram \
     --out src/data/generated \
     --routes all \
     --updated 2026-07-10
   ```

Set `--updated` to the dataset's `last_updated_date`, and update the CC BY 4.0
attribution date shown in the app.

## What it does

- Picks the longest trip per route+direction as the representative pattern.
- Joins stops and the direction's shape, projecting each stop onto the polyline
  with a forward-only search so `progress` stays monotonic even where a route
  doubles back through the CBD.
- Subsamples each shape to ≤300 points and trims it to the played span.
- Parses `Name/Road #num` stop labels into easy / standard / driver answers.

`--routes all` removes stale `route-*.json` files from the output directory
before writing the current official set. Pass a comma-separated list instead
when intentionally generating only a subset.

## Route registry

`src/data/routes.ts` discovers generated `route-*.json` files automatically.
Validation runs at load; a malformed route is skipped with a console warning
rather than crashing the app. Circular services such as Route 35 may publish
one direction; all other current routes publish both directions.
