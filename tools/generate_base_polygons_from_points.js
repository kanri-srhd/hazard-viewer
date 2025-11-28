// tools/generate_base_polygons_from_points.js
// 点データ（substations_points.geojson）から変電所敷地ポリゴンを生成する。
// - 日本境界内の点のみ対象
// - 電圧に応じて buffer 半径を決定
// - 同じ変電所名（正規化）ごとに円を union して1ポリゴンにまとめる
// 出力: data/power/osm/substation_polygons_base.geojson

import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";

const POINTS_PATH = path.resolve(
  "data/power/osm/substations_points.geojson"
);
const JAPAN_BOUNDARY_PATH = path.resolve("data/japan_boundary.geojson");
const OUT_PATH = path.resolve(
  "data/power/osm/substation_polygons_base.geojson"
);

// ----------------- utility -----------------

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

// 電圧(kV)を props から推定
function voltageKvFromProps(props) {
  if (!props) return null;

  // voltage_kv が number なら優先
  if (typeof props.voltage_kv === "number") return props.voltage_kv;

  // voltage 文字列を解析 (例: "275000;66000" / "66000 V" / "275 kV")
  const vstr =
    props.voltage ||
    props["voltage:primary"] ||
    props["voltage_primary"] ||
    null;
  if (!vstr || typeof vstr !== "string") return null;

  // "275000;66000" → 最初の値を取る
  const first = vstr.split(/[;,\s]/).find((x) => x && /\d/.test(x));
  if (!first) return null;

  const num = parseFloat(first);
  if (!isFinite(num)) return null;

  // 10kV未満 or 1000以上なら V単位とみなしてkV変換
  if (num > 1000) return num / 1000.0;
  return num;
}

// 電圧(kV)に応じた buffer 半径(m)
function radiusFromKv(kv) {
  if (!kv || !isFinite(kv)) return 40; // デフォルト

  if (kv >= 500) return 200;
  if (kv >= 275) return 140;
  if (kv >= 154) return 100;
  if (kv >= 66) return 70;
  if (kv >= 22) return 50;
  return 40;
}

// ----------------- main -----------------

async function main() {
  console.log("[base-polygons] Loading points & Japan boundary...");

  const pointsFC = loadJSON(POINTS_PATH);
  const japanFC = loadJSON(JAPAN_BOUNDARY_PATH);
  // 日本国境の MultiPolygon Feature を抽出
  const japanGeomFeature = japanFC.features[0];

  const groups = {}; // key: normalizedName or fallback → turf feature

  let totalPoints = 0;
  let usedPoints = 0;

  for (const f of pointsFC.features) {
    totalPoints++;
    const [lon, lat] = f.geometry.coordinates;

    // まず日本境界内にあるか判定
    const pt = turf.point([lon, lat]);
    const inside = turf.booleanPointInPolygon(pt, japanGeomFeature);
    if (!inside) continue; // 海外 / 境界外はスキップ

    usedPoints++;

    const props = f.properties || {};
    const nameNorm =
      normalizeName(props.name) ||
      // 名前がない場合は座標をkeyに使う
      `${lon.toFixed(4)},${lat.toFixed(4)}`;

    const kv = voltageKvFromProps(props);
    const radius = radiusFromKv(kv);

    const circle = turf.circle([lon, lat], radius, {
      units: "meters",
      steps: 32,
    });

    // 代表プロパティ
    circle.properties = {
      name: props.name || "",
      operator: props.operator || "",
      voltage_kv_est: kv || null,
      source: "generated_from_points",
    };

    if (!groups[nameNorm]) {
      groups[nameNorm] = circle;
    } else {
      // 同じ名前の敷地が複数点から構成される場合、union する
      try {
        groups[nameNorm] = turf.union(groups[nameNorm], circle);
        // union後にもプロパティを保持
        if (groups[nameNorm]) {
          groups[nameNorm].properties = {
            name: props.name || groups[nameNorm].properties?.name || "",
            operator:
              props.operator ||
              groups[nameNorm].properties?.operator ||
              "",
            voltage_kv_est:
              kv ||
              groups[nameNorm].properties?.voltage_kv_est ||
              null,
            source: "generated_from_points",
          };
        }
      } catch (e) {
        // union 失敗時は個別に追加してもよいが、ここでは元を優先し circle を捨てる
        console.warn(
          "[base-polygons] union failed for",
          nameNorm,
          "→ keep existing polygon"
        );
      }
    }
  }

  const features = Object.values(groups);

  const outFC = {
    type: "FeatureCollection",
    features,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(outFC, null, 2));

  console.log(
    `[base-polygons] Total points: ${totalPoints}, used in Japan: ${usedPoints}`
  );
  console.log(
    `[base-polygons] Generated base polygons: ${features.length} → ${OUT_PATH}`
  );
}

main().catch((e) => {
  console.error("[base-polygons] ERROR:", e);
});
