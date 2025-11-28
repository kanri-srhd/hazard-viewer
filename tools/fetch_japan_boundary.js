// tools/fetch_japan_boundary.js
// Fetch OSM relation 382313 (Japan boundary) and output as data/japan_boundary.geojson
// Usage: node tools/fetch_japan_boundary.js

import fs from 'fs';
import https from 'https';
import path from 'path';

const OSM_RELATION_ID = 382313;
const OVERPASS_URL = `https://overpass-api.de/api/interpreter?data=[out:json];relation(${OSM_RELATION_ID});out geom;`;
const OUTPUT_PATH = path.resolve('data/japan_boundary.geojson');

function fetchBoundary() {
  return new Promise((resolve, reject) => {
    https.get(OVERPASS_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
}

function convertToGeoJSON(overpassJson) {
  const rel = overpassJson.elements.find(e => e.type === 'relation');
  if (!rel || !rel.members) throw new Error('No relation geometry found');
  // Only use outer polygons
  const outers = rel.members.filter(m => m.role === 'outer' && m.type === 'way');
  const coords = outers.map(m => m.geometry.map(g => [g.lon, g.lat]));
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { osm_relation: OSM_RELATION_ID },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [coords]
      }
    }]
  };
}

async function main() {
  console.log('[fetch_japan_boundary] Fetching Japan boundary from OSM...');
  const overpassJson = await fetchBoundary();
  const geojson = convertToGeoJSON(overpassJson);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(geojson, null, 2), 'utf8');
  console.log(`[fetch_japan_boundary] Saved to ${OUTPUT_PATH}`);
}

main();
