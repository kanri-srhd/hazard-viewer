// tools/filter_polygons_bbox.js
import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";

const INPUT_PATH = "data/power/osm/substation_polygons.geojson";
const OUTPUT_PATH = "data/power/osm/substation_polygons_filtered.geojson";
const BACKUP_PATH = "data/power/osm/substation_polygons_filtered_backup.geojson";

const JAPAN_BOUNDARY_PATH = "data/japan_boundary.geojson";

// 日本を完全に含むBBOX（海外は国境判定で除外）
const BBOX = [20.0, 118.0, 50.0, 156.0];

// ------------------------------------

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function saveJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  console.log("[write] " + p);
}

// ------------------------------------

function isInsideBBox(coord) {
  return !(
    coord[1] < BBOX[0] ||
    coord[1] > BBOX[2] ||
    coord[0] < BBOX[1] ||
    coord[0] > BBOX[3]
  );
}

// ------------------------------------

(async function main() {
  console.log("[filter] loading Japan boundary & polygons...");

// load
  const japanBoundaryFC = loadJSON(JAPAN_BOUNDARY_PATH);

// 必ず FeatureCollection → Feature（MultiPolygon）に変換する
  const japanBoundary = japanBoundaryFC.features[0];

  const fc = loadJSON(INPUT_PATH);

  const out = {
    type: "FeatureCollection",
    features: []
  };

  for (const f of fc.features) {
    const centroid = turf.centroid(f).geometry.coordinates; // [lon, lat]

    let foreign = false;

    // Step1: BBOX
    if (!isInsideBBox(centroid)) {
      foreign = true;
    }

    // Step2: 国境（最重要）
    if (!foreign) {
      const pt = turf.point(centroid);
      const inside = turf.booleanPointInPolygon(pt, japanBoundary);

      if (!inside) foreign = true;
    }

    f.properties = f.properties || {};
    f.properties.is_foreign = foreign;

    out.features.push(f);
  }

  // backup
  if (fs.existsSync(OUTPUT_PATH)) {
    fs.copyFileSync(OUTPUT_PATH, BACKUP_PATH);
  }

  saveJSON(OUTPUT_PATH, out);
  console.log("[filter] done");
})();
