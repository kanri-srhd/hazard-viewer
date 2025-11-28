const BACKUP_PATH = path.resolve('backup/substation_polygons.geojson');
const INPUT_PATH = path.resolve('data/power/osm/substation_polygons.geojson');
import fs from 'fs';
// tools/filter_polygons_bbox.js
// Apply Japan bbox filter to existing polygon GeoJSON
// Usage: node tools/filter_polygons_bbox.js


import * as turf from '@turf/turf';
import path from 'path';

const JAPAN_BOUNDARY_PATH = path.resolve('data/japan_boundary.geojson');

function main() {
  console.log('[filter-bbox] Loading polygons...');
  const geojson = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  const japanBoundary = JSON.parse(fs.readFileSync(JAPAN_BOUNDARY_PATH, 'utf8'));
  const japanGeometry = japanBoundary.features[0].geometry;
  const originalCount = geojson.features.length;
  console.log(`[filter-bbox] Original features: ${originalCount}`);

  const tagged = [];
  for (const f of geojson.features) {
    let centroid = null;
    if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
      centroid = turf.centroid(f).geometry.coordinates;
    }
    let isForeign = false;
    if (!turf.booleanPointInPolygon(turf.point(centroid), japanGeometry)) {
      isForeign = true;
    }
    f.properties = { ...(f.properties || {}), ...(isForeign ? { is_foreign: true } : {}) };
    tagged.push(f);
  }

  fs.copyFileSync(INPUT_PATH, BACKUP_PATH);
  console.log(`[filter-bbox] Backup saved to ${BACKUP_PATH}`);
  geojson.features = tagged;
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(geojson, null, 2), 'utf8');
  console.log(`[filter-bbox] Saved filtered to ${OUTPUT_PATH}`);
}

main();
