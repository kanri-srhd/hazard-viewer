// tools/generate_national_substation_points.js
// 全国の変電所敷地ポリゴン（base）からポイントを生成し、
// TEPCO capacity 情報をマージして national_substations_all.geojson を作る。

import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";

const BASE_POLYGON_PATH = path.resolve("data/power/osm/substation_polygons_base.geojson");
const TEPCO_CAPACITY_PATH = path.resolve("data/power/capacity/tepco_substations_all_matched.json");
const OUT_PATH = path.resolve("data/power/capacity/national_substations_all.geojson");

// ----------------- util -----------------
function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function normalizeName(name) {
  if (!name) return "";
  return name
    .replace(/変電所/g, "")
    .replace(/[\s\u3000]/g, "")
    .replace(/[（）()]/g, "")
    .toLowerCase();
}

// ----------------- main -----------------
async function main() {
  console.log("[national-pts] Loading base polygons & TEPCO capacity...");

  const baseFC = loadJSON(BASE_POLYGON_PATH);
  const tepcos = loadJSON(TEPCO_CAPACITY_PATH);

  console.log(`[national-pts] Base polygons: ${baseFC.features.length}`);
  console.log(`[national-pts] TEPCO capacity records: ${tepcos.length}`);

  // TEPCO を正規化名で索引
  const tepcosByName = new Map();
  for (const e of tepcos) {
    const key = normalizeName(e.name);
    if (!key) continue;
    // 同じ名前が複数あってもとりあえず最初のを採用（必要なら改善可）
    if (!tepcosByName.has(key)) {
      tepcosByName.set(key, e);
    }
  }

  let matched = 0;
  let idCounter = 1;

  const features = baseFC.features.map((poly) => {
    const props = poly.properties || {};
    const name = props.name || props["name:ja"] || props.operator || "";
    const norm = normalizeName(name);

    // ポリゴンの centroid（点の位置）
    const centroid = turf.centroid(poly);
    const [lon, lat] = centroid.geometry.coordinates;

    // TEPCO capacity マッチング
    const te = norm && tepcosByName.get(norm);
    if (te) matched++;

    const fProps = {
      id: te?.id || idCounter++,
      name: name,
      name_ja: props["name:ja"] || "",
      operator: props.operator || "",
      // 敷地の推定電圧（base生成時の voltage_kv_est があれば利用）
      voltage_kv: te?.voltage_kv ?? props.voltage_kv_est ?? null,
      // capacity 情報（TEPCOエリアのみ）
      available_kw: te?.available_kw ?? null,
      updated_at: te?.updated_at ?? null,
      utility: te?.utility ?? props.operator ?? "",
      matched_source: te ? (te.matched_source || "tepco_capacity") : "polygon_only",
      confidence: te?.confidence ?? 1.0,
      is_foreign: false // base は国内のみ生成している前提
    };

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lon, lat]
      },
      properties: fProps
    };
  });

  const outFC = {
    type: "FeatureCollection",
    features
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(outFC, null, 2));

  console.log(`[national-pts] Generated national substation points: ${features.length}`);
  console.log(`[national-pts] Matched TEPCO capacity: ${matched}`);
  console.log(`[national-pts] Output: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error("[national-pts] ERROR:", e);
});
