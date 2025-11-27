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

// Japan bbox filter (post-processing)
const JAPAN_BBOX = {
  minLat: 24.0,
  maxLat: 45.5,
  minLon: 123.0,
  maxLon: 148.0
};

// Japan-only bounding box (tighter to exclude Korea/Russia)
// South: 24°N (Okinawa), North: 45.5°N (Hokkaido)
// West: 123°E (Yonaguni), East: 148°E (Hokkaido/Kuril)
const overpassQuery = `
[out:json][timeout:180];
(
  // power=substation polygons (ways + relations) Japan bbox only
  way["power"="substation"](24.0,123.0,45.5,148.0);
  relation["power"="substation"](24.0,123.0,45.5,148.0);
  // Some mappers use landuse=substation
  way["landuse"="substation"](24.0,123.0,45.5,148.0);
  relation["landuse"="substation"](24.0,123.0,45.5,148.0);
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
      if (n && typeof n.lon === 'number' && typeof n.lat === 'number') {
        coords.push([n.lon, n.lat]);
      }
    }
    // Ensure closed ring
    if (coords.length >= 3) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
      
      // Calculate centroid for bbox filtering
      const centroid = coords.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
      const lon = centroid[0] / coords.length;
      const lat = centroid[1] / coords.length;
      
      // Skip if outside Japan bbox
      if (lat < JAPAN_BBOX.minLat || lat > JAPAN_BBOX.maxLat || 
          lon < JAPAN_BBOX.minLon || lon > JAPAN_BBOX.maxLon) {
        continue;
      }
      
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
    for (const m of r.members) {
      if (m.type !== 'way') continue;
      const way = ways.find(w => w.id === m.ref);
      if (!way || !way.nodes) continue;
      const ring = [];
      for (const nid of way.nodes) {
        const n = nodes.get(nid);
        if (n && typeof n.lon === 'number' && typeof n.lat === 'number') {
          ring.push([n.lon, n.lat]);
        }
      }
      if (ring.length >= 3) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
        if (m.role !== 'inner') {
          // Only include outer rings for now to avoid invalid MultiPolygon construction
          outers.push(ring);
        }
      }
    }
    if (outers.length) {
      // Calculate centroid from first outer ring for bbox filtering
      const firstOuter = outers[0];
      const centroid = firstOuter.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
      const lon = centroid[0] / firstOuter.length;
      const lat = centroid[1] / firstOuter.length;
      
      // Skip if outside Japan bbox
      if (lat < JAPAN_BBOX.minLat || lat > JAPAN_BBOX.maxLat || 
          lon < JAPAN_BBOX.minLon || lon > JAPAN_BBOX.maxLon) {
        continue;
      }
      
      features.push({
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates: outers.map(o => [o]) },
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
  fs.writeFileSync(OUT_PATH, JSON.stringify(geojson, null, 2), 'utf8');
  console.log('[osm-substations] Saved to', OUT_PATH);
}

main().catch(err => {
  console.error('[osm-substations] Failed:', err);
  process.exit(1);
});
