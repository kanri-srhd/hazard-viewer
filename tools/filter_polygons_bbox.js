// tools/filter_polygons_bbox.js
// Apply Japan bbox filter to existing polygon GeoJSON
// Usage: node tools/filter_polygons_bbox.js

import fs from 'fs';
import path from 'path';

const INPUT_PATH = path.resolve('data/power/osm/substation_polygons.geojson');
const OUTPUT_PATH = path.resolve('data/power/osm/substation_polygons.geojson');
const BACKUP_PATH = path.resolve('data/power/osm/substation_polygons.geojson.backup');

const JAPAN_BBOX = {
  minLat: 24.0,
  maxLat: 45.5,
  minLon: 123.0,
  maxLon: 148.0
};

// Korean characters filter (Hangul)
function hasKoreanCharacters(name) {
  if (!name) return false;
  return /[\uAC00-\uD7AF]/.test(name);
}


// Cyrillic (Russian etc.)
function hasCyrillicCharacters(name) {
  if (!name) return false;
  return /[\u0400-\u04FF]/.test(name);
}

function calculateCentroid(geometry) {
  let totalLon = 0, totalLat = 0, count = 0;
  
  if (geometry.type === 'Polygon') {
    for (const coord of geometry.coordinates[0]) {
      totalLon += coord[0];
      totalLat += coord[1];
      count++;
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const coord of polygon[0]) {
        totalLon += coord[0];
        totalLat += coord[1];
        count++;
      }
    }
  }
  
  return count > 0 ? [totalLon / count, totalLat / count] : null;
}

function isInJapanBboxOrTagForeign(centroid, properties) {
  if (!centroid) return { keep: false, foreign: false };
  
  // Foreign by name
  const n = properties?.name || '';
  let foreign = hasKoreanCharacters(n) || hasCyrillicCharacters(n);
  
  const [lon, lat] = centroid;
  
  // Whitelist windows for Japanese islands (override exclusions)
  const IN_HOKKAIDO = (lat >= 41.0 && lat <= 46.0 && lon >= 139.0 && lon <= 146.5);
  const IN_HONSHU   = (lat >= 33.0 && lat <= 41.0 && lon >= 130.0 && lon <= 142.0);
  const IN_SHIKOKU  = (lat >= 32.5 && lat <= 34.9 && lon >= 132.0 && lon <= 134.9);
  const IN_KYUSHU   = (lat >= 30.5 && lat <= 33.9 && lon >= 129.0 && lon <= 132.5);
  const IN_OKINAWA  = (lat >= 24.0 && lat <= 27.5 && lon >= 122.0 && lon <= 131.0);
  if (IN_HOKKAIDO || IN_HONSHU || IN_SHIKOKU || IN_KYUSHU || IN_OKINAWA) {
    return { keep: true, foreign };
  }
  
  // Exclude Korean peninsula (approx window)
  // Lat 33-39°N and Lon 124-128°E considered Korea region
  if (lat >= 33.0 && lat <= 39.0 && lon >= 124.0 && lon < 128.0) foreign = true;

  // Exclude Russian Far East (Primorsky Krai, Sakhalin)
  // If longitude > 142°E and latitude > 44°N, likely Sakhalin/North Kurils
  if (lon > 142 && lat > 44) foreign = true;
  // If latitude > 43°N and longitude > 131°E and < 142°E (Primorsky/Amur coast), exclude
  if (lat > 43 && lon > 131 && lon < 142) foreign = true;
  
  const inBbox = lat >= JAPAN_BBOX.minLat && lat <= JAPAN_BBOX.maxLat &&
                 lon >= JAPAN_BBOX.minLon && lon <= JAPAN_BBOX.maxLon;
  return { keep: inBbox, foreign };
}

async function main() {
  console.log('[filter-bbox] Loading polygons...');
  const geojson = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  
  const originalCount = geojson.features.length;
  console.log(`[filter-bbox] Original features: ${originalCount}`);
  
  // Tag foreign and keep data; filter only outside bbox
  const tagged = [];
  for (const f of geojson.features) {
    const centroid = calculateCentroid(f.geometry);
    const result = isInJapanBboxOrTagForeign(centroid, f.properties);
    if (result.keep) {
      if (result.foreign) {
        f.properties = { ...(f.properties || {}), is_foreign: true };
      }
      tagged.push(f);
    }
  }
  
  const removedCount = originalCount - tagged.length;
  console.log(`[filter-bbox] Filtered features: ${tagged.length}`);
  console.log(`[filter-bbox] Removed (outside Japan): ${removedCount}`);
  
  // Backup original
  if (removedCount > 0) {
    fs.copyFileSync(INPUT_PATH, BACKUP_PATH);
    console.log(`[filter-bbox] Backup saved to ${BACKUP_PATH}`);
    
    // Write filtered
    geojson.features = tagged;
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(geojson, null, 2), 'utf8');
    console.log(`[filter-bbox] Saved filtered to ${OUTPUT_PATH}`);
  } else {
    console.log('[filter-bbox] No changes needed');
  }
}

main().catch(err => {
  console.error('[filter-bbox] Failed:', err);
  process.exit(1);
});
