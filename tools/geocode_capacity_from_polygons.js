// tools/geocode_capacity_from_polygons.js
// Geocode capacity data points using substation polygon centroids.
// For each capacity record:
//   - If lat/lon is missing or mismatched (via name lookup), use polygon centroid.
// Usage:
//   node tools/geocode_capacity_from_polygons.js <capacity-json-path>
// Output:
//   Overwrites input file with corrected coordinates.

import fs from 'fs';
import path from 'path';

const POLYGONS_PATH = path.resolve('data/power/osm/substation_polygons_with_generated.geojson');

function normalizeName(name) {
  if (!name) return '';
  return name.replace(/変電所/g, '')
             .replace(/[\s\u3000]/g, '')
             .replace(/[（）()]/g, '')
             .toLowerCase();
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

function featureCentroid(feature) {
  const g = feature.geometry;
  if (!g) return undefined;
  if (g.type === 'Polygon') {
    const rings = g.coordinates || [];
    if (!rings.length) return undefined;
    return centroidLatLon(rings[0]);
  } else if (g.type === 'MultiPolygon') {
    // Use centroid of first polygon
    const polys = g.coordinates || [];
    if (!polys.length || !polys[0].length) return undefined;
    return centroidLatLon(polys[0][0]);
  }
  return undefined;
}

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: node tools/geocode_capacity_from_polygons.js <capacity-json-path>');
    process.exit(1);
  }
  const capacityPath = path.resolve(args[0]);

  console.log('[geocode] Loading polygons...');
  const polygons = loadJSON(POLYGONS_PATH);
  
  // Build name→centroid lookup
  const nameMap = new Map();
  for (const f of polygons.features) {
    const name = f.properties?.name;
    if (!name) continue;
    const norm = normalizeName(name);
    if (!norm) continue;
    const centroid = featureCentroid(f);
    if (!centroid) continue;
    const [lon, lat] = centroid;
    nameMap.set(norm, { lon, lat, name });
  }
  console.log(`[geocode] Built lookup for ${nameMap.size} polygons`);

  console.log('[geocode] Loading capacity data...');
  const capacity = loadJSON(capacityPath);
  if (!Array.isArray(capacity)) {
    console.error('[geocode] Capacity file must be an array of objects');
    process.exit(1);
  }

  let fixed = 0;
  let filled = 0;
  for (const rec of capacity) {
    const norm = normalizeName(rec.name || rec.name_normalized);
    if (!norm) continue;
    const match = nameMap.get(norm);
    if (!match) continue;

    const hasCoord = (rec.lat != null && rec.lon != null);
    if (!hasCoord) {
      // Fill missing coordinates
      rec.lat = match.lat;
      rec.lon = match.lon;
      rec.geocoded_from = 'polygon_centroid';
      filled++;
    } else {
      // Check if coordinates are significantly different (mismatch)
      const dist = Math.sqrt(Math.pow(rec.lat - match.lat, 2) + Math.pow(rec.lon - match.lon, 2));
      // threshold: ~0.01 degree ≈ 1km
      if (dist > 0.01) {
        console.log(`[geocode] Fixing mismatch for "${rec.name}": was (${rec.lat}, ${rec.lon}), now (${match.lat}, ${match.lon})`);
        rec.lat = match.lat;
        rec.lon = match.lon;
        rec.geocoded_from = 'polygon_centroid_corrected';
        fixed++;
      }
    }
  }

  console.log(`[geocode] Fixed mismatched: ${fixed}`);
  console.log(`[geocode] Filled missing: ${filled}`);
  console.log(`[geocode] Writing corrected data to ${capacityPath}`);
  fs.writeFileSync(capacityPath, JSON.stringify(capacity, null, 2), 'utf8');
  console.log('[geocode] Done');
}

main();
