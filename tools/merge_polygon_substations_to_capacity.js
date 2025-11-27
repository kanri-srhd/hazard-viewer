// tools/merge_polygon_substations_to_capacity.js
// Merge substation polygons into capacity data as points (using centroids).
// For polygons without matching capacity records, create placeholder entries.
// Usage:
//   node tools/merge_polygon_substations_to_capacity.js
// Output:
//   Overwrites data/power/capacity/tepco_substations_all_matched.json

import fs from 'fs';
import path from 'path';

const POLYGONS_PATH = path.resolve('data/power/osm/substation_polygons_with_generated.geojson');
const CAPACITY_PATH = path.resolve('data/power/capacity/tepco_substations_all_matched.json');

function normalizeName(name) {
  if (!name) return '';
  return name.replace(/変電所/g, '')
             .replace(/[\s\u3000]/g, '')
             .replace(/[（）()]/g, '')
             .toLowerCase();
}

function centroidLatLon(coords) {
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

function featureCentroid(feature) {
  const g = feature.geometry;
  if (!g) return undefined;
  if (g.type === 'Polygon') {
    const rings = g.coordinates || [];
    if (!rings.length) return undefined;
    return centroidLatLon(rings[0]);
  } else if (g.type === 'MultiPolygon') {
    const polys = g.coordinates || [];
    if (!polys.length || !polys[0].length) return undefined;
    return centroidLatLon(polys[0][0]);
  }
  return undefined;
}

function parseVoltageKv(props) {
  if (typeof props?.voltage_kv === 'number') return props.voltage_kv;
  const v = props?.voltage;
  if (typeof v === 'string') {
    const parts = v.split(';').map(s => s.trim()).filter(Boolean);
    const nums = parts.map(s => parseFloat(s) / 1000).filter(n => !isNaN(n));
    if (nums.length) return Math.max(...nums);
  }
  return undefined;
}

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  console.log('[merge] Loading polygons and capacity data...');
  const polygons = loadJSON(POLYGONS_PATH);
  const capacity = loadJSON(CAPACITY_PATH);

  // Build name set from existing capacity records
  const existingNames = new Set();
  for (const rec of capacity) {
    const norm = normalizeName(rec.name || rec.name_normalized);
    if (norm) existingNames.add(norm);
  }
  console.log(`[merge] Existing capacity records: ${capacity.length}`);
  console.log(`[merge] Unique normalized names: ${existingNames.size}`);

  // Add missing substations from polygons (Japan bbox only)
  const JAPAN_BBOX = { minLat: 24.0, maxLat: 45.5, minLon: 123.0, maxLon: 148.0 };
   let koreanNames = 0;
  let added = 0;
  let outsideBbox = 0;
  for (const f of polygons.features) {
    const name = f.properties?.name;
    if (!name) continue;
    const norm = normalizeName(name);
    if (!norm || existingNames.has(norm)) continue;

    const centroid = featureCentroid(f);
    if (!centroid) continue;
    const [lon, lat] = centroid;
    
    // Skip if outside Japan
      if (!isInJapan(lat, lon, name)) {
        if (hasKoreanCharacters(name)) {
          koreanNames++;
        } else {
          outsideBbox++;
        }
      continue;
    }

    const voltage_kv = parseVoltageKv(f.properties);
    const newEntry = {
      id: `polygon_${f.properties.id || added}`,
      name: name,
      name_normalized: norm,
      utility: f.properties.operator || 'Unknown',
      voltage_kv: voltage_kv || 66,
      available_kw: null,
      updated_at: null,
      lat: lat,
      lon: lon,
      matched_source: 'polygon_only',
      confidence: 1.0,
      notes: 'Generated from OSM polygon (no capacity data available)',
      geocoded_from: 'polygon_centroid'
    };
    capacity.push(newEntry);
    existingNames.add(norm);
    added++;
  }

  console.log(`[merge] Added ${added} new entries from polygons`);
  console.log(`[merge] Skipped ${outsideBbox} entries outside Japan bbox`);
  console.log(`[merge] Skipped ${koreanNames} entries with Korean names`);
  console.log(`[merge] Total records: ${capacity.length}`);
  
// Korean characters filter (Hangul)
function hasKoreanCharacters(name) {
  if (!name) return false;
  return /[\uAC00-\uD7AF]/.test(name);
}


function hasCyrillicCharacters(name) {
  if (!name) return false;
  return /[\u0400-\u04FF]/.test(name);
}

function isInJapan(lat, lon, name) {
  // Exclude foreign-language names (Korean/Chinese/Cyrillic)
  if (hasKoreanCharacters(name) || hasCyrillicCharacters(name)) return false;
  
  // Basic bbox check
  if (lat < JAPAN_BBOX.minLat || lat > JAPAN_BBOX.maxLat || 
      lon < JAPAN_BBOX.minLon || lon > JAPAN_BBOX.maxLon) {
    return false;
  }
  
  // More strict filtering for areas near Korea
  // Below 38°N, longitude must be > 128°E (excludes Korean peninsula)
  if (lat < 38.0 && lon < 128.0) return false;
  // Exclude Russian Far East regions (Primorsky, Sakhalin)
  if (lon > 142 && lat > 44) return false;
  if (lat > 43 && lon > 131 && lon < 142) return false;
  
  return true;
}
  console.log(`[merge] Writing to ${CAPACITY_PATH}`);
  fs.writeFileSync(CAPACITY_PATH, JSON.stringify(capacity, null, 2), 'utf8');
  console.log('[merge] Done');
}

main();
