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

function isInJapanBbox(centroid, properties) {
  if (!centroid) return false;
  
  // Exclude names indicating foreign data
  const n = properties?.name || '';
  if (hasKoreanCharacters(n) || hasCyrillicCharacters(n)) return false;
  
  const [lon, lat] = centroid;
  
  // More strict filtering for areas near Korea
  // Below 38°N, longitude must be > 128°E (excludes Korean peninsula)
  if (lat < 38.0 && lon < 128.0) return false;

  // Exclude Russian Far East (Primorsky Krai, Sakhalin)
  // If longitude > 142°E and latitude > 44°N, likely Sakhalin/North Kurils
  if (lon > 142 && lat > 44) return false;
  // If latitude > 43°N and longitude > 131°E and < 142°E (Primorsky/Amur coast), exclude
  if (lat > 43 && lon > 131 && lon < 142) return false;
  
  return lat >= JAPAN_BBOX.minLat && lat <= JAPAN_BBOX.maxLat &&
         lon >= JAPAN_BBOX.minLon && lon <= JAPAN_BBOX.maxLon;
}

async function main() {
  console.log('[filter-bbox] Loading polygons...');
  const geojson = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  
  const originalCount = geojson.features.length;
  console.log(`[filter-bbox] Original features: ${originalCount}`);
  
  // Filter features by Japan bbox
  const filtered = geojson.features.filter(f => {
    const centroid = calculateCentroid(f.geometry);
    return isInJapanBbox(centroid, f.properties);
  });
  
  const removedCount = originalCount - filtered.length;
  console.log(`[filter-bbox] Filtered features: ${filtered.length}`);
  console.log(`[filter-bbox] Removed (outside Japan): ${removedCount}`);
  
  // Backup original
  if (removedCount > 0) {
    fs.copyFileSync(INPUT_PATH, BACKUP_PATH);
    console.log(`[filter-bbox] Backup saved to ${BACKUP_PATH}`);
    
    // Write filtered
    geojson.features = filtered;
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
