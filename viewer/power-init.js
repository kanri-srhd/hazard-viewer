// viewer/power-init.js
// ============================================================================
// 電力レイヤー（送電線・変電所ポイント・変電所ポリゴン）初期化
// ============================================================================

import { fetchJSON } from "./utils/fetchJSON.js";
import { detectPrefecture } from "./utils/prefDetect.js";
import { POWER_LAYERS, POWER_SOURCES } from "./layers/power.js";

// =============================================================================
// 初期状態
// =============================================================================

const state = {
  line_500kv: false,
  line_275kv: false,
  line_154kv: false,
  line_other: false,
  substations: false, // ポイント + ポリゴン
};

// =============================================================================
// 可視性切替ユーティリティ
// =============================================================================

function setLayerVisibilityById(id, visible) {
  try {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  } catch (e) {
    console.warn("[power] visibility error for layer:", id, e);
  }
}

// =============================================================================
// 可視性一括切替
// =============================================================================

export function setVisibility(key, visible) {
  state[key] = visible;

  switch (key) {
    case "line_500kv":
      setLayerVisibilityById(POWER_LAYERS.LINE_500, visible);
      break;

    case "line_275kv":
      setLayerVisibilityById(POWER_LAYERS.LINE_275, visible);
      break;

    case "line_154kv":
      setLayerVisibilityById(POWER_LAYERS.LINE_154, visible);
      break;

    case "line_other":
      setLayerVisibilityById(POWER_LAYERS.LINE_OTHER, visible);
      break;

    case "substations":
      // ポイント
      setLayerVisibilityById(POWER_LAYERS.SUBSTATION, visible);

      // ★ ポリゴン（fill）
      setLayerVisibilityById("power-substation-polygons", visible);
      break;
  }
}

// =============================================================================
// ソース追加
// =============================================================================

function addSources() {
  // OSM powerlines
  if (!map.getSource(POWER_SOURCES.LINES)) {
    map.addSource(POWER_SOURCES.LINES, {
      type: "geojson",
      data: "data/osm/powerlines_osm.geojson",
    });
  }

  // Substations (ポイント)
  if (!map.getSource(POWER_SOURCES.SUBSTATIONS)) {
    map.addSource(POWER_SOURCES.SUBSTATIONS, {
      type: "geojson",
      data: "data/osm/substations_points.geojson",
    });
  }

  // ★ Substation polygons
  if (!map.getSource("power-substation-polygons-src")) {
    map.addSource("power-substation-polygons-src", {
      type: "geojson",
      data: "data/osm/substation_polygons_base.geojson",
    });
  }
}

// =============================================================================
// 送電線レイヤー（lines）
// =============================================================================

function addLineLayers() {
  // 500kV
  if (!map.getLayer(POWER_LAYERS.LINE_500)) {
    map.addLayer({
      id: POWER_LAYERS.LINE_500,
      type: "line",
      source: POWER_SOURCES.LINES,
      minzoom: 3,
      maxzoom: 22,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#ff0000",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3, 2.5,
          8, 4.5,
          12, 6.5,
          14, 8.5,
        ],
        "line-opacity": 1.0,
      },
      filter: [
        "all",
        ["has", "voltage_numeric"],
        [">=", ["get", "voltage_numeric"], 400000],
      ],
    });
  }

  // 275kV
  if (!map.getLayer(POWER_LAYERS.LINE_275)) {
    map.addLayer({
      id: POWER_LAYERS.LINE_275,
      type: "line",
      source: POWER_SOURCES.LINES,
      minzoom: 3,
      maxzoom: 22,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#ff8800",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3, 2.3,
          8, 4.0,
          12, 6.0,
          14, 8.0,
        ],
        "line-opacity": 1.0,
      },
      filter: [
        "all",
        ["has", "voltage_numeric"],
        [">=", ["get", "voltage_numeric"], 200000],
        ["<", ["get", "voltage_numeric"], 400000],
      ],
    });
  }

  // 154kV
  if (!map.getLayer(POWER_LAYERS.LINE_154)) {
    map.addLayer({
      id: POWER_LAYERS.LINE_154,
      type: "line",
      source: POWER_SOURCES.LINES,
      minzoom: 3,
      maxzoom: 22,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#ffff00",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3, 1.8,
          8, 3.0,
          12, 4.8,
          14, 6.0,
        ],
        "line-opacity": 1.0,
      },
      filter: [
        "all",
        ["has", "voltage_numeric"],
        [">=", ["get", "voltage_numeric"], 140000],
        ["<", ["get", "voltage_numeric"], 200000],
      ],
    });
  }

  // その他
  if (!map.getLayer(POWER_LAYERS.LINE_OTHER)) {
    map.addLayer({
      id: POWER_LAYERS.LINE_OTHER,
      type: "line",
      source: POWER_SOURCES.LINES,
      minzoom: 3,
      maxzoom: 22,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#999999",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3, 1.4,
          8, 2.4,
          12, 4.0,
          14, 5.0,
        ],
        "line-opacity": 1.0,
      },
      filter: [
        "any",
        ["!", ["has", "voltage_numeric"]],
        ["<", ["get", "voltage_numeric"], 140000],
      ],
    });
  }
}

// =============================================================================
// 変電所ポイント（circle）
// =============================================================================

function addSubstationLayer() {
  if (!map.getLayer(POWER_LAYERS.SUBSTATION)) {
    map.addLayer({
      id: POWER_LAYERS.SUBSTATION,
      type: "circle",
      source: POWER_SOURCES.SUBSTATIONS,
      minzoom: 3,
      maxzoom: 22,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3, 1.5,
          8, 2.0,
          12, 3.0,
          14, 4.0,
        ],
        "circle-color": "#000000",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1
      },
    });
  }
}

// =============================================================================
// ★ 変電所ポリゴン（fill）
// =============================================================================

function addSubstationPolygonsLayer() {
  if (!map.getLayer("power-substation-polygons")) {
    map.addLayer({
      id: "power-substation-polygons",
      type: "fill",
      source: "power-substation-polygons-src",
      layout: { visibility: "none" },
      paint: {
        "fill-color": [
          "case",
          [">", ["get", "voltage_numeric"], 300000], "#d6b3ff",
          [">", ["get", "voltage_numeric"], 100000], "#e8c9a9",
          "#bbbbbb",
        ],
        "fill-opacity": 0.5,
        "fill-outline-color": "#444444",
      },
    });
  }
}

// =============================================================================
// レイヤー追加順序（重要）
// =============================================================================

function addLayers() {
  addSources();

  // ★ ポリゴン → ライン → ポイント
  addSubstationPolygonsLayer();
  addLineLayers();
  addSubstationLayer();
}

// =============================================================================
// メインエクスポート
// =============================================================================

export function initPowerLayers(mapInstance) {
  map = mapInstance;

  console.log("[power] init");

  addLayers();

  return {
    setVisibility,
    state,
  };
}
