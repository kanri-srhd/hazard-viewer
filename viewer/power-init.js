// viewer/power-init.js
// ============================================================================
// 送電線・変電所（OSM）レイヤー初期化（UDL方針に沿った UI アダプタ）
// ============================================================================
//
// 役割：
// - viewer/data/osm/*.geojson を MapLibre ソースとして登録
// - 送電線レイヤー（500/275/154/その他）と変電所（ポイント＋ポリゴン）を追加
// - ui-init.js からのトグル要求
//    "line_500kv" / "line_275kv" / "line_154kv" / "line_other" / "substations"
//   に応じて可視性を切り替える API を提供
//
// 注意：
// - capacity-engine（空容量）は UDL / Engines で扱うため、ここから直接呼ばない
//   （README の UDL レイヤ構造に従い、UI層から Engines へ直結しない）

// -----------------------------------------------------------------------------
// MapLibre インスタンス（共有）
// -----------------------------------------------------------------------------
let map;

// -----------------------------------------------------------------------------
// Source / Layer ID（PROJECT_STATE を厳守：viewer/data/osm/*）
// -----------------------------------------------------------------------------
const POWER_SOURCES = {
  LINES: "power-lines-osm",
  SUB_POINTS: "power-substations-points",
  SUB_POLY: "power-substations-polygons",
};

const POWER_LAYERS = {
  // 送電線
  LINE_500: "power-line-500kv",
  LINE_275: "power-line-275kv",
  LINE_154: "power-line-154kv",
  LINE_OTHER: "power-line-other",

  // 変電所
  SUB_POINTS: "power-substations-points-layer",
  SUB_POLY: "power-substations-polygons-layer",
};

// -----------------------------------------------------------------------------
// UI 状態（ui-init.js のターゲットキーと 1:1 対応）
// -----------------------------------------------------------------------------
const state = {
  line_500kv: false,
  line_275kv: false,
  line_154kv: false,
  line_other: false,
  substations: false, // ポイント + ポリゴン
};

// -----------------------------------------------------------------------------
// Utility：レイヤー可視性
// -----------------------------------------------------------------------------
function setLayerVisibility(id, visible) {
  if (!map) return;
  if (!map.getLayer(id)) return;
  map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
}

// -----------------------------------------------------------------------------
// ソース登録（PROJECT_STATE のパスをそのまま使用）
// -----------------------------------------------------------------------------
function addSources() {
  // 送電線
  if (!map.getSource(POWER_SOURCES.LINES)) {
    map.addSource(POWER_SOURCES.LINES, {
      type: "geojson",
      data: "data/osm/powerlines_osm.geojson",
    });
  }

  // 変電所ポイント
  if (!map.getSource(POWER_SOURCES.SUB_POINTS)) {
    map.addSource(POWER_SOURCES.SUB_POINTS, {
      type: "geojson",
      data: "data/osm/substations_points.geojson",
    });
  }

  // 変電所ポリゴン
  if (!map.getSource(POWER_SOURCES.SUB_POLY)) {
    map.addSource(POWER_SOURCES.SUB_POLY, {
      type: "geojson",
      data: "data/osm/substation_polygons_base.geojson",
    });
  }
}

// -----------------------------------------------------------------------------
// 送電線レイヤー（OIM に近い色分け）
// -----------------------------------------------------------------------------
function addLineLayers() {
  // 500kV（濃赤）
  if (!map.getLayer("power-line-500kv")) {
    map.addLayer({
      id: "power-line-500kv",
      type: "line",
      source: POWER_SOURCES.LINES,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#d32f2f",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          4, 1.6, 8, 3.0, 12, 4.6, 14, 6.0
        ],
        "line-opacity": 0.95,
      },
      filter: [
        "all",
        ["has", "voltage_numeric"],
        [">=", ["get", "voltage_numeric"], 400000],
      ],
    });
  }

  // 275kV（濃橙）
  if (!map.getLayer("power-line-275kv")) {
    map.addLayer({
      id: "power-line-275kv",
      type: "line",
      source: POWER_SOURCES.LINES,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#f57c00",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          4, 1.4, 8, 2.6, 12, 4.0, 14, 5.4
        ],
        "line-opacity": 0.95,
      },
      filter: [
        "all",
        ["has", "voltage_numeric"],
        [">=", ["get", "voltage_numeric"], 200000],
        ["<", ["get", "voltage_numeric"], 400000],
      ],
    });
  }

  // 154kV（黄色）
  if (!map.getLayer("power-line-154kv")) {
    map.addLayer({
      id: "power-line-154kv",
      type: "line",
      source: POWER_SOURCES.LINES,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#fbc02d",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          4, 1.2, 8, 2.2, 12, 3.4, 14, 4.5
        ],
        "line-opacity": 0.9,
      },
      filter: [
        "all",
        ["has", "voltage_numeric"],
        [">=", ["get", "voltage_numeric"], 140000],
        ["<", ["get", "voltage_numeric"], 200000],
      ],
    });
  }

  // その他（灰色）
  if (!map.getLayer("power-line-other")) {
    map.addLayer({
      id: "power-line-other",
      type: "line",
      source: POWER_SOURCES.LINES,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#999999",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          4, 1.1, 8, 2.0, 12, 3.2, 14, 4.2
        ],
        "line-opacity": 0.75,
      },
      filter: [
        "any",
        ["!", ["has", "voltage_numeric"]],
        ["<", ["get", "voltage_numeric"], 140000],
      ],
    });
  }
}


// -----------------------------------------------------------------------------
// 変電所レイヤー（OIM と同じポリゴン＋小さなポイント）
// -----------------------------------------------------------------------------
function addSubstationLayers() {
  // ポリゴン
  if (!map.getLayer(POWER_LAYERS.SUB_POLY)) {
    map.addLayer({
      id: POWER_LAYERS.SUB_POLY,
      type: "fill",
      source: POWER_SOURCES.SUB_POLY,
      layout: { visibility: "none" },
      paint: {
        "fill-color": "#c8a4ff",
        "fill-opacity": 0.32,
        "fill-outline-color": "#6a4faa",
      },
    });
  }

  // ポイント
  if (!map.getLayer(POWER_LAYERS.SUB_POINTS)) {
    map.addLayer({
      id: POWER_LAYERS.SUB_POINTS,
      type: "circle",
      source: POWER_SOURCES.SUB_POINTS,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          4, 2.0,
          8, 3.0,
          12, 4.0,
          14, 5.0,
        ],
        "circle-color": "#000000",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1,
      },
    });

    // ポップアップ：OSM 属性のみ（容量は後続の UDL/Engines で統合）
    map.on("click", POWER_LAYERS.SUB_POINTS, (e) => {
      if (!e.features?.length) return;
      const props = e.features[0].properties || {};

      const name = props.name || "変電所";
      const operator = props.operator || props["operator:en"] || "N/A";
      const voltage =
        props.voltage || (props.voltage_kv ? `${props.voltage_kv} kV` : "N/A");

      const html = `
        <div style="font-size:13px;font-family:sans-serif;line-height:1.4;">
          <b>${name}</b><br>
          運営者: ${operator}<br>
          電圧: ${voltage}<br>
        </div>
      `;

      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    });

    map.on("mouseenter", POWER_LAYERS.SUB_POINTS, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", POWER_LAYERS.SUB_POINTS, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

// -----------------------------------------------------------------------------
// UI から呼ばれる公開 API（main.js → ui-init.js）
// -----------------------------------------------------------------------------
export function setPowerVisibility(key, visible) {
  state[key] = visible;

  switch (key) {
    case "line_500kv":
      setLayerVisibility("power-line-500kv", visible);
      break;

    case "line_275kv":
      setLayerVisibility("power-line-275kv", visible);
      break;

    case "line_154kv":
      setLayerVisibility("power-line-154kv", visible);
      break;

    case "line_other":
      setLayerVisibility("power-line-other", visible);
      break;

    case "substations":
      setLayerVisibility(POWER_LAYERS.SUB_POLY, visible);
      setLayerVisibility(POWER_LAYERS.SUB_POINTS, visible);
      break;
  }
}

// -----------------------------------------------------------------------------
// init（main.js の map.on("load") から呼ばれる）
// -----------------------------------------------------------------------------
//
// main.js イメージ：
//
//   const powerController = initPowerLayers(map);
//   initPowerLayerToggles(powerController);
//
export function initPowerLayers(mapInstance) {
  map = mapInstance;

  console.log("[power-init] load OSM power layers");

  addSources();
  addLineLayers();
  addSubstationLayers();

  return {
    state,
    setVisibility: setPowerVisibility,
  };
}
