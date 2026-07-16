#!/usr/bin/env node
/**
 * Transport Victoria GTFS -> game route JSON generator (PRD §9).
 *
 * Reads an extracted metropolitan-tram GTFS directory (branch "3" of the
 * official gtfs.zip: routes/trips/stop_times/stops/shapes .txt) and writes
 * one versioned JSON per requested route into src/data/generated/.
 *
 * Usage:
 *   node scripts/gtfs/build-routes.mjs \
 *     --gtfs /path/to/extracted/tram \
 *     --out src/data/generated \
 *     --routes all \
 *     --updated 2026-07-10
 *
 * Data: "Contains public transport data supplied by the Victorian
 * Department of Transport and Planning, licensed under CC BY 4.0."
 */
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

const MAX_SHAPE_POINTS = 300;

// ---------- CLI ----------
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const GTFS_DIR = args.gtfs;
const OUT_DIR = args.out ?? 'src/data/generated';
const INDEX_ONLY = process.argv.includes('--index-only');
const ROUTE_ARG = args.routes ?? 'all';
const ALL_ROUTES = ROUTE_ARG.trim().toLowerCase() === 'all';
let targets = ALL_ROUTES ? [] : ROUTE_ARG.split(',').map((s) => s.trim()).filter(Boolean);
const UPDATED = args.updated ?? new Date().toISOString().slice(0, 10);
if (!GTFS_DIR && !INDEX_ONLY) {
  console.error('Missing --gtfs <dir with routes.txt / trips.txt / stop_times.txt / stops.txt / shapes.txt>');
  process.exit(1);
}

// ---------- CSV ----------
function splitCsv(line) {
  const out = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cell);
      cell = '';
    } else cell += ch;
  }
  out.push(cell);
  return out;
}

async function* rows(file) {
  const rl = readline.createInterface({
    input: createReadStream(path.join(GTFS_DIR, file)),
    crlfDelay: Infinity,
  });
  let header = null;
  for await (const raw of rl) {
    const line = raw.replace(/^﻿/, '');
    if (!line.trim()) continue;
    const cells = splitCsv(line);
    if (!header) {
      header = cells.map((h) => h.trim());
      continue;
    }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = cells[i];
    yield row;
  }
}

// ---------- geometry ----------
function planarScale(points) {
  const midLat = points.reduce((s, p) => s + p[1], 0) / points.length;
  return Math.cos((midLat * Math.PI) / 180);
}

function cumulativeArcs(points, kx) {
  const arcs = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = (points[i][0] - points[i - 1][0]) * kx;
    const dy = points[i][1] - points[i - 1][1];
    arcs.push(arcs[i - 1] + Math.hypot(dx, dy));
  }
  return arcs;
}

/** Uniformly subsample a polyline to at most max points, keeping both ends. */
function subsample(points, max) {
  if (points.length <= max) return points;
  const out = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

/** Build the small eager catalog used before any full route is requested. */
async function writeOverviewIndex(outDir) {
  const files = (await readdir(outDir))
    .filter((file) => /^route-[a-z0-9-]+\.json$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const routes = [];
  let sourceUpdatedAt = '';
  for (const file of files) {
    const data = JSON.parse(await readFile(path.join(outDir, file), 'utf8'));
    sourceUpdatedAt ||= data.sourceUpdatedAt;
    routes.push({
      id: data.route.id,
      shortName: data.route.shortName,
      longName: data.route.longName,
      color: data.route.color,
      totalStops: Math.max(...data.route.directions.map((direction) => direction.stops.length)),
      directionCount: data.route.directions.length,
      overviewShape: subsample(data.route.directions[0].shape, 64),
    });
  }
  const index = { schemaVersion: 1, sourceUpdatedAt, routes };
  await writeFile(path.join(outDir, 'index.json'), JSON.stringify(index));
  console.log(`wrote ${path.join(outDir, 'index.json')}: ${routes.length} lightweight route summaries`);
}

if (INDEX_ONLY) {
  await writeOverviewIndex(OUT_DIR);
  process.exit(0);
}

/**
 * Project each stop (in travel order) onto the polyline, searching only
 * forward from the previous stop's segment so progress stays monotonic
 * even where the route crosses itself near the CBD.
 */
function projectStopsMonotonic(points, arcs, kx, stops) {
  const result = [];
  let fromSeg = 0;
  for (const stop of stops) {
    let best = { arc: arcs[fromSeg], d2: Infinity };
    for (let i = fromSeg; i < points.length - 1; i++) {
      const ax = points[i][0] * kx;
      const ay = points[i][1];
      const bx = points[i + 1][0] * kx;
      const by = points[i + 1][1];
      const px = stop.lon * kx;
      const py = stop.lat;
      const vx = bx - ax;
      const vy = by - ay;
      const len2 = vx * vx + vy * vy;
      const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * vx + (py - ay) * vy) / len2)) : 0;
      const qx = ax + vx * t;
      const qy = ay + vy * t;
      const d2 = (px - qx) ** 2 + (py - qy) ** 2;
      if (d2 < best.d2) {
        best = { arc: arcs[i] + Math.hypot(vx * t, vy * t), d2, seg: i };
      }
    }
    if (best.seg !== undefined) fromSeg = best.seg;
    const prevArc = result.length > 0 ? result[result.length - 1] : -Infinity;
    result.push(Math.max(best.arc, prevArc + 1e-9));
  }
  return result;
}

/** Point on the polyline at a given arc length. */
function pointAtArc(points, arcs, arc) {
  for (let i = 1; i < arcs.length; i++) {
    if (arcs[i] >= arc) {
      const span = arcs[i] - arcs[i - 1];
      const t = span > 0 ? (arc - arcs[i - 1]) / span : 0;
      return [
        points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t,
        points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t,
      ];
    }
  }
  return points[points.length - 1];
}

/** Cut the polyline to [arcStart, arcEnd]. */
function trimPolyline(points, arcs, arcStart, arcEnd) {
  const out = [pointAtArc(points, arcs, arcStart)];
  for (let i = 0; i < points.length; i++) {
    if (arcs[i] > arcStart && arcs[i] < arcEnd) out.push(points[i]);
  }
  out.push(pointAtArc(points, arcs, arcEnd));
  return out;
}

// ---------- name parsing ----------
function parseStopName(name) {
  const m = name.match(/^(.*?)(?:\s+#(\S+))?$/);
  const base = (m?.[1] ?? name).trim();
  const stopNumber = m?.[2] ?? null;
  const easy = base.split('/')[0].trim();
  return {
    displayName: name,
    stopNumber,
    answers: {
      easy: [easy],
      standard: [base],
      driver: [name],
    },
  };
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// ---------- main ----------
console.log(`GTFS source: ${GTFS_DIR}`);
console.log(`Requested routes: ${ALL_ROUTES ? 'all metropolitan tram routes' : targets.join(', ')} · updated ${UPDATED}`);

// Pass 1: routes.txt -> target route ids + metadata
const routeMeta = new Map(); // route_id -> {short, long, color}
for await (const r of rows('routes.txt')) {
  if (ALL_ROUTES || targets.includes(r.route_short_name)) {
    routeMeta.set(r.route_id, {
      short: r.route_short_name,
      long: r.route_long_name,
      color: r.route_color ? `#${r.route_color}` : '#50A83B',
    });
  }
}
if (ALL_ROUTES) {
  targets = [...routeMeta.values()]
    .map((meta) => meta.short)
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}
const foundShorts = new Set([...routeMeta.values()].map((m) => m.short));
for (const t of targets) {
  if (!foundShorts.has(t)) throw new Error(`route ${t} not found in routes.txt`);
}
console.log(`Resolved routes (${targets.length}): ${targets.join(', ')}`);

// Pass 2: trips.txt -> trips of target routes
const trips = new Map(); // trip_id -> {short, dir, shapeId, headsign}
for await (const t of rows('trips.txt')) {
  const meta = routeMeta.get(t.route_id);
  if (!meta) continue;
  trips.set(t.trip_id, {
    short: meta.short,
    dir: Number(t.direction_id ?? 0),
    shapeId: t.shape_id,
    headsign: t.trip_headsign,
  });
}
console.log(`target trips: ${trips.size}`);

// Pass 3: stop_times.txt (streamed, grouped by trip) -> best trip per route+direction
const best = new Map(); // `${short}:${dir}` -> {tripId, stops:[stop_id], shapeId, headsign}
let curTrip = null;
let curStops = [];
function closeBlock() {
  if (!curTrip) return;
  const info = trips.get(curTrip);
  if (info) {
    const key = `${info.short}:${info.dir}`;
    const prev = best.get(key);
    if (!prev || curStops.length > prev.stops.length) {
      curStops.sort((a, b) => a.seq - b.seq);
      best.set(key, {
        tripId: curTrip,
        stops: curStops.map((s) => s.stopId),
        shapeId: info.shapeId,
        headsign: info.headsign,
      });
    }
  }
  curStops = [];
}
for await (const st of rows('stop_times.txt')) {
  if (st.trip_id !== curTrip) {
    closeBlock();
    curTrip = st.trip_id;
    if (!trips.has(curTrip)) curTrip = null; // skip non-target blocks cheaply
  }
  if (curTrip) curStops.push({ stopId: st.stop_id, seq: Number(st.stop_sequence) });
}
closeBlock();
for (const [key, b] of best) console.log(`  ${key} -> ${b.stops.length} stops (${b.headsign})`);

// Pass 4: stops.txt -> details for used stops
const usedStopIds = new Set([...best.values()].flatMap((b) => b.stops));
const stopDetails = new Map();
for await (const s of rows('stops.txt')) {
  if (usedStopIds.has(s.stop_id)) {
    stopDetails.set(s.stop_id, {
      name: s.stop_name,
      lat: Number(s.stop_lat),
      lon: Number(s.stop_lon),
    });
  }
}

// Pass 5: shapes.txt -> points for used shapes
const usedShapeIds = new Set([...best.values()].map((b) => b.shapeId));
const shapePts = new Map(); // shape_id -> [[lon,lat,seq],...]
for await (const p of rows('shapes.txt')) {
  if (!usedShapeIds.has(p.shape_id)) continue;
  if (!shapePts.has(p.shape_id)) shapePts.set(p.shape_id, []);
  shapePts.get(p.shape_id).push([Number(p.shape_pt_lon), Number(p.shape_pt_lat), Number(p.shape_pt_sequence)]);
}

// ---------- build game JSON per route ----------
await mkdir(OUT_DIR, { recursive: true });
if (ALL_ROUTES) {
  for (const file of await readdir(OUT_DIR)) {
    if (/^route-[a-z0-9-]+\.json$/i.test(file)) await unlink(path.join(OUT_DIR, file));
  }
}

for (const short of targets) {
  const meta = [...routeMeta.values()].find((m) => m.short === short);
  const directions = [];
  const stopsDict = {};

  const directionIds = [...best.keys()]
    .filter((key) => key.startsWith(`${short}:`))
    .map((key) => Number(key.slice(key.lastIndexOf(':') + 1)))
    .sort((a, b) => a - b);
  if (directionIds.length === 0) throw new Error(`route ${short}: no trips found`);

  for (const dir of directionIds) {
    const b = best.get(`${short}:${dir}`);
    if (!b) throw new Error(`route ${short} direction ${dir}: no trips found`);
    const rawShape = (shapePts.get(b.shapeId) ?? [])
      .sort((a, c) => a[2] - c[2])
      .map(([lon, lat]) => [lon, lat]);
    if (rawShape.length < 2) throw new Error(`route ${short} dir ${dir}: shape ${b.shapeId} missing`);

    const shape = subsample(rawShape, MAX_SHAPE_POINTS);
    const kx = planarScale(shape);
    const arcs = cumulativeArcs(shape, kx);

    const stopCoords = b.stops.map((id) => {
      const d = stopDetails.get(id);
      if (!d) throw new Error(`stop ${id} missing from stops.txt`);
      return d;
    });
    const stopArcs = projectStopsMonotonic(shape, arcs, kx, stopCoords);

    const arcStart = stopArcs[0];
    const arcEnd = stopArcs[stopArcs.length - 1];
    const trimmed = trimPolyline(shape, arcs, arcStart, arcEnd).map(([lon, lat]) => [
      Number(lon.toFixed(6)),
      Number(lat.toFixed(6)),
    ]);
    const span = Math.max(arcEnd - arcStart, 1e-9);

    const dirStopIds = b.stops.map((gtfsId, i) => {
      const id = `s${gtfsId}-d${dir}`;
      const d = stopDetails.get(gtfsId);
      const parsed = parseStopName(d.name);
      const rawProgress = (stopArcs[i] - arcStart) / span;
      const prev = i > 0 ? stopsDict[`s${b.stops[i - 1]}-d${dir}`].position.progress : -1;
      const progress = Math.min(1, Math.max(rawProgress, prev + 1e-6));
      stopsDict[id] = {
        ...parsed,
        landmark: null,
        position: { lat: d.lat, lon: d.lon, progress: Number(progress.toFixed(6)) },
      };
      return id;
    });

    directions.push({
      id: `to-${slug(b.headsign) || `dir-${dir}`}`,
      headsign: b.headsign,
      stops: dirStopIds,
      shape: trimmed,
    });
  }

  // Direction ids must be unique within a route, including circular routes.
  directions.forEach((direction, i) => {
    if (directions.slice(0, i).some((other) => other.id === direction.id)) direction.id += `-${i + 1}`;
  });

  const json = {
    schemaVersion: 2,
    sourceUpdatedAt: UPDATED,
    note: 'Generated from Transport Victoria GTFS Schedule (CC BY 4.0) by scripts/gtfs/build-routes.mjs. Do not edit by hand.',
    route: {
      id: `tram-${short}`,
      shortName: short,
      longName: meta.long,
      color: meta.color,
      directions,
    },
    stops: stopsDict,
  };

  const outFile = path.join(OUT_DIR, `route-${short}.json`);
  await writeFile(outFile, JSON.stringify(json));
  console.log(
    `wrote ${outFile}: ${directions.map((d) => `${d.stops.length} stops/${d.shape.length} pts (${d.headsign})`).join(' | ')}`,
  );
}
await writeOverviewIndex(OUT_DIR);
console.log('done');
