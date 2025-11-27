// tools/generate_missing_substation_polygons.js
// Generate synthetic polygons for substations that lack OSM area polygons.
// Strategy: For each substation point (TEPCO dataset) whose normalized name is not present
// in existing OSM power=substation polygons, create a circular approximation buffered
// by voltage class. Output merged FeatureCollection.
// Usage:
//   node tools/generate_missing_substation_polygons.js
// Output:
//   data/power/osm/substation_polygons_with_generated.geojson

import fs from 'fs';
import path from 'path';

const BASE_POLYGON_PATH = path.resolve('data/power/osm/substation_polygons.geojson');
const SUBSTATION_POINTS_PATH = path.resolve('data/power/capacity/tepco_substations_all_matched.json');
const OUT_PATH = path.resolve('data/power/osm/substation_polygons_with_generated.geojson');

function normalizeName(name) {
  if (!name) return '';
  return name.replace(/変電所/g, '') // remove suffix
             .replace(/[\s\u3000]/g, '') // remove whitespace (ASCII + full-width)
             .replace(/[（）()]/g, '') // remove parens
             .toLowerCase();
}

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function decideRadiusMeters(voltage) {
  if (!voltage || isNaN(voltage)) return 40; // default small distribution
  if (voltage >= 500) return 260;
  if (voltage >= 275) return 190;
  if (voltage >= 154) return 130;
  if (voltage >= 66) return 85;
  if (voltage >= 22) return 55;
  return 40; // 6.6kV or unknown
}

function circlePolygon(lon, lat, radiusMeters, segments = 24) {
  // Convert meters to degrees. Latitude: ~111320 m per degree. Longitude scales by cos(lat).
  const latDegPerMeter = 1 / 111320;
  const lonDegPerMeter = 1 / (111320 * Math.cos(lat * Math.PI / 180));
  const coords = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    const dx = Math.cos(theta) * radiusMeters;
    const dy = Math.sin(theta) * radiusMeters;
    const ptLon = lon + dx * lonDegPerMeter;
    const ptLat = lat + dy * latDegPerMeter;
    coords.push([ptLon, ptLat]);
  }
  // close ring
  coords.push(coords[0]);
  return coords;
}

function main() {
  console.log('[missing-polygons] Loading base polygons & substation points...');
  const base = loadJSON(BASE_POLYGON_PATH); // FeatureCollection
  const points = loadJSON(SUBSTATION_POINTS_PATH); // array of objects

  const existingNameSet = new Set();
  for (const f of base.features) {
    const n = f.properties?.name;
    if (n) existingNameSet.add(normalizeName(n));
  }
  console.log(`[missing-polygons] Existing polygon names: ${existingNameSet.size}`);

  const generatedFeatures = [];
  let skippedNoCoord = 0;
  let matchedExisting = 0;

  for (const s of points) {
    if (s.lat == null || s.lon == null) { skippedNoCoord++; continue; }
    const norm = normalizeName(s.name || s.name_normalized);
    if (norm && existingNameSet.has(norm)) { matchedExisting++; continue; }

    const rMeters = decideRadiusMeters(s.voltage_kv);
    const ring = circlePolygon(s.lon, s.lat, rMeters);
    const areaEst = Math.PI * rMeters * rMeters;

    generatedFeatures.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        name: s.name,
        id: s.id,
        utility: s.utility,
        voltage_kv: s.voltage_kv,
        generated: true,
        generation_method: 'radius_buffer',
        footprint_radius_m: rMeters,
        area_est_m2: Math.round(areaEst),
        source: 'synthetic'
      }
    });
  }

  const merged = {
    type: 'FeatureCollection',
    features: [...base.features, ...generatedFeatures]
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2), 'utf8');

  console.log(`[missing-polygons] Generated synthetic polygons: ${generatedFeatures.length}`);
  console.log(`[missing-polygons] Existing matched (skipped): ${matchedExisting}`);
  console.log(`[missing-polygons] Missing coords skipped: ${skippedNoCoord}`);
  console.log('[missing-polygons] Output:', OUT_PATH);
}

main();
