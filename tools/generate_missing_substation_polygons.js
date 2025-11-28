const BASE_POLYGON_PATH = path.resolve('data/power/osm/substation_polygons.geojson');
const SUBSTATION_POINTS_PATH = path.resolve('data/power/osm/substations_points.geojson');
const OUT_PATH = path.resolve('data/power/osm/substation_polygons_with_generated.geojson');
import fs from 'fs';
// tools/generate_missing_substation_polygons.js
// Generate synthetic polygons for substations that lack OSM area polygons.
// Strategy: For each substation point (TEPCO dataset) whose normalized name is not present
// in existing OSM power=substation polygons, create a circular approximation buffered
// by voltage class. Output merged FeatureCollection.
// Usage:
//   node tools/generate_missing_substation_polygons.js
// Output:
//   data/power/osm/substation_polygons_with_generated.geojson


import * as turf from '@turf/turf';
import path from 'path';

const JAPAN_BOUNDARY_PATH = path.resolve('data/japan_boundary.geojson');

function isInJapan(lat, lon, japanGeometry) {
  return turf.booleanPointInPolygon(turf.point([lon, lat]), japanGeometry);
}

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

function parseVoltageKvFromProps(props) {
  // Try voltage_kv numeric
  if (typeof props?.voltage_kv === 'number') return props.voltage_kv;
  // Try voltage string like "275000;66000" or "66000"
  const v = props?.voltage;
  if (typeof v === 'string') {
    const parts = v.split(';').map(s => s.trim()).filter(Boolean);
    const nums = parts.map(s => parseFloat(s) / (s.length > 0 ? 1000 : 1)).filter(n => !isNaN(n));
    if (nums.length) return Math.max(...nums);
  }
  return undefined;
}

function centroidLatLon(coords) {
  // coords: array of [lon, lat]
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const a = x1 * y2 - x2 * y1;
    area += a;
    cx += (x1 + x2) * a;
    cy += (y1 + y2) * a;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-12) return coords[0];
  return [cx / (6 * area), cy / (6 * area)];
}

function ringAreaMeters(coords) {
  // Approximate planar area by converting degrees to meters using centroid latitude
  const [, lat] = centroidLatLon(coords);
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(lat * Math.PI / 180);
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const X1 = x1 * mPerDegLon;
    const Y1 = y1 * mPerDegLat;
    const X2 = x2 * mPerDegLon;
    const Y2 = y2 * mPerDegLat;
    area += (X1 * Y2 - X2 * Y1);
  }
  return Math.abs(area) * 0.5;
}

function featureAreaMeters(feature) {
  const g = feature.geometry;
  if (!g) return undefined;
  if (g.type === 'Polygon') {
    const rings = g.coordinates || [];
    if (!rings.length) return undefined;
    // Outer ring minus holes (if any)
    let total = ringAreaMeters(rings[0]);
    for (let i = 1; i < rings.length; i++) total -= ringAreaMeters(rings[i]);
    return total;
  } else if (g.type === 'MultiPolygon') {
    let total = 0;
    for (const poly of g.coordinates || []) {
      if (!poly.length) continue;
      total += ringAreaMeters(poly[0]);
      for (let i = 1; i < poly.length; i++) total -= ringAreaMeters(poly[i]);
    }
    return total;
  }
  return undefined;
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
  const pointsFC = loadJSON(SUBSTATION_POINTS_PATH); // FeatureCollection
  const points = pointsFC.features || []; // array of features
  const japanBoundary = JSON.parse(fs.readFileSync(JAPAN_BOUNDARY_PATH, 'utf8'));
  const japanGeometry = japanBoundary.features[0].geometry;

  const existingNameSet = new Set();
  const areaStats = { 500: [], 275: [], 154: [], 66: [], 22: [], 6.6: [] };
  for (const f of base.features) {
    const n = f.properties?.name;
    if (n) existingNameSet.add(normalizeName(n));
    const area = featureAreaMeters(f);
    const vk = parseVoltageKvFromProps(f.properties);
    if (area && vk) {
      const bin = vk >= 500 ? 500 : vk >= 275 ? 275 : vk >= 154 ? 154 : vk >= 66 ? 66 : vk >= 22 ? 22 : 6.6;
      areaStats[bin].push(area);
    }
  }
  console.log(`[missing-polygons] Existing polygon names: ${existingNameSet.size}`);

  // Compute median area per bin
  const tunedRadiusByBin = {};
  for (const [binStr, arr] of Object.entries(areaStats)) {
    const arrSorted = arr.slice().sort((a, b) => a - b);
    const median = arrSorted.length ? arrSorted[Math.floor(arrSorted.length / 2)] : undefined;
    if (median) {
      const r = Math.sqrt(median / Math.PI);
      tunedRadiusByBin[binStr] = Math.max(30, Math.min(r, 350));
    }
  }
  console.log('[missing-polygons] Tuned radii (m):', tunedRadiusByBin);

  const generatedFeatures = [];
  let skippedNoCoord = 0;
  let matchedExisting = 0;
  let taggedForeign = 0;
  for (const s of points) {
    if (s.lat == null || s.lon == null) { skippedNoCoord++; continue; }
    const isForeign = !isInJapan(s.lat, s.lon, japanGeometry);
    const norm = normalizeName(s.name || s.name_normalized);
    if (norm && existingNameSet.has(norm)) { matchedExisting++; continue; }

    const bin = (s.voltage_kv >= 500) ? 500 : (s.voltage_kv >= 275) ? 275 : (s.voltage_kv >= 154) ? 154 : (s.voltage_kv >= 66) ? 66 : (s.voltage_kv >= 22) ? 22 : 6.6;
    const tuned = tunedRadiusByBin[bin];
    const rDefault = decideRadiusMeters(s.voltage_kv);
    const rMeters = tuned ? Math.round(tuned) : rDefault;
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
        source: 'synthetic',
        ...(isForeign ? { is_foreign: true } : {})
      }
    });
    if (isForeign) taggedForeign++;
  }

  const merged = {
    type: 'FeatureCollection',
    features: [
      ...base.features.map(f => ({
        ...f,
        properties: {
          ...f.properties,
          area_est_m2: featureAreaMeters(f),
          voltage_kv_numeric: parseVoltageKvFromProps(f.properties)
        }
      })),
      ...generatedFeatures
    ]
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2), 'utf8');

  console.log(`[missing-polygons] Generated synthetic polygons: ${generatedFeatures.length}`);
  console.log(`[missing-polygons] Existing matched (skipped): ${matchedExisting}`);
  console.log(`[missing-polygons] Missing coords skipped: ${skippedNoCoord}`);
  console.log(`[missing-polygons] Foreign (is_foreign:true) tagged: ${taggedForeign}`);
  console.log('[missing-polygons] Output:', OUT_PATH);
}

main();
