#!/usr/bin/env node
/**
 * osm_power_export.js
 *
 * Exports nationwide power infrastructure from OpenStreetMap via Overpass API.
 * - power=line (transmission lines)
 * - power=substation (substations)
 *
 * Features:
 * - Tiles Japan into a grid of bounding boxes to avoid timeouts
 * - Retries on rate limit (429) and transient errors
 * - Streams results to GeoJSON files per feature type
 *
 * Usage:
 *   node tools/osm_power_export.js --outDir data/power/osm --tileSize 1.0 --maxConcurrent 2
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.findIndex(a => a === `--${name}`);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return def;
}

const outDir = getArg('outDir', path.resolve(__dirname, '../data/power/osm'));
const tileSize = parseFloat(getArg('tileSize', '1.5')); // degrees
const maxConcurrent = parseInt(getArg('maxConcurrent', '2'), 10);
const endpoint = getArg('endpoint', 'https://overpass-api.de/api/interpreter');

// Japan approximate bounding box (lon/lat)
const JAPAN_BOUNDS = {
  minLon: 122.0,
  minLat: 20.0,
  maxLon: 154.0,
  maxLat: 46.0,
};

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function tileBounds(bounds, step) {
  const tiles = [];
  for (let lat = bounds.minLat; lat < bounds.maxLat; lat += step) {
    for (let lon = bounds.minLon; lon < bounds.maxLon; lon += step) {
      const minLat = lat;
      const minLon = lon;
      const maxLat = Math.min(lat + step, bounds.maxLat);
      const maxLon = Math.min(lon + step, bounds.maxLon);
      tiles.push({ minLat, minLon, maxLat, maxLon });
    }
  }
  return tiles;
}

function overpassQueryBBox(minLat, minLon, maxLat, maxLon) {
  // QL: fetch lines and substations in bbox
  return `[
    out:json][timeout:180];
    (
      way["power"="line"](${minLat},${minLon},${maxLat},${maxLon});
      relation["power"="line"](${minLat},${minLon},${maxLat},${maxLon});
      node["power"="substation"](${minLat},${minLon},${maxLat},${maxLon});
      way["power"="substation"](${minLat},${minLon},${maxLat},${maxLon});
      relation["power"="substation"](${minLat},${minLon},${maxLat},${maxLon});
    );
    out body; >; out skel qt;`;
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          const err = new Error(`HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          err.body = data;
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(`data=${encodeURIComponent(body)}`);
    req.end();
  });
}

async function fetchTile(tile, attempt = 1) {
  const ql = overpassQueryBBox(tile.minLat, tile.minLon, tile.maxLat, tile.maxLon);
  try {
    const res = await httpsPost(endpoint, ql);
    return JSON.parse(res.body);
  } catch (err) {
    const status = err.statusCode || 0;
    const backoff = Math.min(60, attempt * 5);
    if (status === 429 || status === 504 || status === 502) {
      await new Promise(r => setTimeout(r, backoff * 1000));
      return fetchTile(tile, attempt + 1);
    }
    throw err;
  }
}

function osmToGeoJSON(osm) {
  // Minimal conversion: separate LineString for power=line ways/relations, Point/Polygon for substations
  // For production use, consider osmtogeojson package; here we avoid deps.
  const nodesById = new Map();
  const ways = [];
  const relations = [];
  for (const el of osm.elements || []) {
    if (el.type === 'node') nodesById.set(el.id, el);
    else if (el.type === 'way') ways.push(el);
    else if (el.type === 'relation') relations.push(el);
  }
  const features = [];

  function coordsOfWay(w) {
    const coords = [];
    for (const nid of w.nodes) {
      const n = nodesById.get(nid);
      if (n) coords.push([n.lon, n.lat]);
    }
    return coords;
  }

  for (const w of ways) {
    const power = w.tags?.power;
    if (power === 'line') {
      features.push({
        type: 'Feature',
        properties: { ...w.tags, source: 'osm', feature_type: 'line' },
        geometry: { type: 'LineString', coordinates: coordsOfWay(w) },
      });
    } else if (power === 'substation') {
      const coords = coordsOfWay(w);
      const isPolygon = coords.length > 2 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];
      features.push({
        type: 'Feature',
        properties: { ...w.tags, source: 'osm', feature_type: 'substation' },
        geometry: isPolygon ? { type: 'Polygon', coordinates: [coords] } : { type: 'LineString', coordinates: coords },
      });
    }
  }

  for (const r of relations) {
    const power = r.tags?.power;
    if (power === 'line') {
      // Simplistic: collect member ways' coords
      const coords = [];
      for (const m of r.members || []) {
        if (m.type === 'way') {
          const w = ways.find(x => x.id === m.ref);
          if (w) coords.push(...coordsOfWay(w));
        }
      }
      if (coords.length) {
        features.push({
          type: 'Feature',
          properties: { ...r.tags, source: 'osm', feature_type: 'line' },
          geometry: { type: 'LineString', coordinates: coords },
        });
      }
    } else if (power === 'substation') {
      // Often relations outline polygons; simplify like ways
      const coords = [];
      for (const m of r.members || []) {
        if (m.type === 'way') {
          const w = ways.find(x => x.id === m.ref);
          if (w) coords.push(...coordsOfWay(w));
        }
      }
      if (coords.length) {
        const isPolygon = coords.length > 2 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];
        features.push({
          type: 'Feature',
          properties: { ...r.tags, source: 'osm', feature_type: 'substation' },
          geometry: isPolygon ? { type: 'Polygon', coordinates: [coords] } : { type: 'LineString', coordinates: coords },
        });
      }
    }
  }

  return { type: 'FeatureCollection', features };
}

async function main() {
  ensureDir(outDir);
  const tiles = tileBounds(JAPAN_BOUNDS, tileSize);
  console.log(`Tiles: ${tiles.length}, size=${tileSize}deg, concurrency=${maxConcurrent}`);

  const queue = tiles.slice();
  let active = 0;
  let done = 0;

  const lines = [];
  const substations = [];

  async function worker() {
    while (queue.length) {
      const t = queue.shift();
      active++;
      try {
        const osm = await fetchTile(t);
        const gj = osmToGeoJSON(osm);
        for (const f of gj.features) {
          if (f.properties.feature_type === 'line') lines.push(f);
          else if (f.properties.feature_type === 'substation') substations.push(f);
        }
        done++;
        process.stdout.write(`\rFetched ${done}/${tiles.length}`);
      } catch (e) {
        console.error(`\nTile failed:`, t, e.message);
      } finally {
        active--;
      }
    }
  }

  const workers = [];
  for (let i = 0; i < maxConcurrent; i++) workers.push(worker());
  await Promise.all(workers);

  const outLines = { type: 'FeatureCollection', features: lines };
  const outSubs = { type: 'FeatureCollection', features: substations };

  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, 'grid_lines_osm.geojson'), JSON.stringify(outLines));
  fs.writeFileSync(path.join(outDir, 'substations_osm.geojson'), JSON.stringify(outSubs));

  console.log(`\nWritten: ${path.join(outDir, 'grid_lines_osm.geojson')}`);
  console.log(`Written: ${path.join(outDir, 'substations_osm.geojson')}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
