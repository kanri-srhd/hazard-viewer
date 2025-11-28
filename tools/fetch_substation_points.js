// tools/fetch_substation_points.js
// Fetch OSM substation points and output as data/power/osm/substations_points.geojson
// Usage: node tools/fetch_substation_points.js

import fs from 'fs';
import https from 'https';
import path from 'path';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter?data=[out:json];node["power"="substation"](area:3600024091);out;';
const OUTPUT_PATH = path.resolve('data/power/osm/substations_points.geojson');

function fetchSubstations() {
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
  const features = overpassJson.elements.filter(e => e.type === 'node').map(node => ({
    type: 'Feature',
    properties: {
      id: node.id,
      name: node.tags?.name || '',
      operator: node.tags?.operator || '',
      voltage: node.tags?.voltage || '',
      ...node.tags
    },
    geometry: {
      type: 'Point',
      coordinates: [node.lon, node.lat]
    }
  }));
  return {
    type: 'FeatureCollection',
    features
  };
}

async function main() {
  console.log('[fetch_substation_points] Fetching OSM substation points...');
  const overpassJson = await fetchSubstations();
  const geojson = convertToGeoJSON(overpassJson);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(geojson, null, 2), 'utf8');
  console.log(`[fetch_substation_points] Saved to ${OUTPUT_PATH}`);
}

main();
