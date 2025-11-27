// tools/osm_substation_polygons_export.js
// Fetch OSM power=substation polygons via Overpass API and save as GeoJSON
// Usage (PowerShell):
//   node tools/osm_substation_polygons_export.js
// Output:
//   data/power/osm/substation_polygons.geojson

import fs from 'fs';
import path from 'path';
import https from 'https';

const OUT_PATH = path.resolve('data/power/osm/substation_polygons.geojson');

// Overpass API endpoint
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// For national coverage, we will tile Japan bbox roughly into manageable chunks to avoid timeouts.
// Here we start with a single query; can be extended to tiles if needed.
// Note: relations can represent multipolygons; we request ways and relations with area=yes.
const overpassQuery = `
[out:json][timeout:180];
(
  way["power"="substation"]["area"="yes"](24.0,122.9,46.1,153.0);
  relation["power"="substation"]["area"="yes"](24.0,122.9,46.1,153.0);
);
out body;
>;
out skel qt;
`;

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const postData = `data=${encodeURIComponent(query)}`;
    const req = https.request(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error('Failed to parse Overpass response: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Convert Overpass JSON to GeoJSON using a simple assembler for ways/relations
function overpassToGeoJSON(overpassJson) {
  const nodes = new Map();
  const ways = [];
  const rels = [];

  for (const el of overpassJson.elements || []) {
    if (el.type === 'node') nodes.set(el.id, el);
    else if (el.type === 'way') ways.push(el);
    else if (el.type === 'relation') rels.push(el);
  }

  const features = [];

  // Ways to polygons
  for (const w of ways) {
    if (!w.nodes || !w.tags || w.tags.power !== 'substation') continue;
    const coords = [];
    for (const nid of w.nodes) {
      const n = nodes.get(nid);
      if (n) coords.push([n.lon, n.lat]);
    }
    // Ensure closed ring
    if (coords.length >= 3) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: { ...w.tags, id: w.id }
      });
    }
  }

  // Relations (multipolygons)
  for (const r of rels) {
    if (!r.members || !r.tags || r.tags.power !== 'substation') continue;
    const outers = [];
    const inners = [];
    for (const m of r.members) {
      if (m.type !== 'way') continue;
      const way = ways.find(w => w.id === m.ref);
      if (!way || !way.nodes) continue;
      const ring = [];
      for (const nid of way.nodes) {
        const n = nodes.get(nid);
        if (n) ring.push([n.lon, n.lat]);
      }
      if (ring.length >= 3) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
        if (m.role === 'inner') inners.push(ring);
        else outers.push(ring);
      }
    }
    if (outers.length) {
      features.push({
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates: outers.map(o => [o]).concat(inners.length ? inners.map(i => [i]) : []) },
        properties: { ...r.tags, id: r.id }
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

async function main() {
  console.log('[osm-substations] Fetching substation polygons from Overpass...');
  const json = await fetchOverpass(overpassQuery);
  const geojson = overpassToGeoJSON(json);
  console.log(`[osm-substations] Polygons assembled: ${geojson.features.length}`);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(geojson));
  console.log('[osm-substations] Saved to', OUT_PATH);
}

main().catch(err => {
  console.error('[osm-substations] Failed:', err);
  process.exit(1);
});
