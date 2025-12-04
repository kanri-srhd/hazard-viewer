// viewer/power-init.js
// ============================================================================
// 送電線・変電所（OSM）レイヤー初期化
// ============================================================================

import { attachCapacityToSubstation } from "../engines/capacity-engine.js";

// -----------------------------------------------------------------------------
// MapLibre 共有インスタンス
// -----------------------------------------------------------------------------
let map;

// -----------------------------------------------------------------------------
// Source / Layer ID（PROJECT_STATE に基づく “事実”）
// -----------------------------------------------------------------------------
const POWER_SOURCES = {
  LINES: "power-lines-osm",
  SUB_POINTS: "power-substations-points",
  SUB_POLY: "power-substations-polygons",
};

const POWER_LAYERS = {
  // 送電線
  BACKBONE_500: "power-line-500kv",
  BACKBONE_275: "power-line-275kv",
  GENERAL_154: "power-line-154kv",
  GENERAL_OTHER: "power-line-other",

  // 変電所
  SUB_POINTS: "power-substations-points-layer",
  SUB_POLY: "power-substations-polygons-layer",
};

// -----------------------------------------------------------------------------
// UI の状態
// -----------------------------------------------------------------------------
const state = {
  line_backbone: false,
  line_general: false,
  substations: false,
};

// -----------------------------------------------------------------------------
// Utility: 可視性
// -----------------------------------------------------------------------------
function vis(id, v) {
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
  }
}

// -----------------------------------------------------------------------------
// ソース追加（PROJECT_STATE のパスをそのまま使用）
// -----------------------------------------------------------------------------
function addSources() {
  // 送電線
  if (!map.getSource(POWER_SOURCES.LINES)) {
    map.addSource(POWER_SOURCES.LINES, {
      type: "geojson",
      data: "viewer/data/osm/powerlines_osm.geojson",
    });
  }

  // 変電所ポイント
  if (!map.getSource(POWER_SOURCES.SUB_POINTS)) {
    map.addSource(POWER_SOURCES.SUB_POINTS, {
      type: "geojson",
      data: "viewer/data/osm/substations_points.geojson",
    });
  }

  // 変電所ポリゴン
  if (!map.getSource(POWER_SOURCES.SUB_POLY)) {
    map.addSource(POWER_SOURCES.SUB_POLY, {
      type: "geojson",
      data: "viewer/data/osm/substation_polygons_base.geojson",
    });
  }
}

// -----------------------------------------------------------------------------
// 送電線レイヤー（基幹 + 一般）
// -----------------------------------------------------------------------------
function addLineLayers() {
  // 500 kV
  if (!map.getLayer(POWER_LAYERS.BACKBONE_500)) {
    map.addLayer({
      id: POWER_LAYERS.BACKBONE_500,
      type: "line",
      source: POWER_SOURCES.LINES,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#d32f2f", // 濃赤
        "line-width": 3,
      },
      filter: [
        "all",
        ["has", "voltage_numeric"],
        [">=", ["get", "voltage_numeric"], 400000],
      ],
    });
  }

  // 275 kV
  if (!map.getLayer(POWER_LAYERS.BACKBONE_275)) {
    map.addLayer({
      id: POWER_LAYERS.BACKBONE_275,
      type: "line",
      source: POWER_SOURCES.LINES,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#f57c00", // 濃橙
        "line-width": 2.8,
      },
      filter: [
        "all",
        ["has", "voltage_numeric"],
        [">=", ["get", "voltage_numeric"], 200000],
        ["<", ["get", "voltage_numeric"], 400000],
      ],
    });
  }

  // 154 kV
  if (!map.getLayer(POWER_LAYERS.GENERAL_154)) {
    map.addLayer({
      id: POWER_LAYERS.GENERAL_154,
      type: "line",
      source: POWER_SOURCES.LINES,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#fbc02d", // 黄色
        "line-width": 2.5,
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
  if (!map.getLayer(POWER_LAYERS.GENERAL_OTHER)) {
    map.addLayer({
      id: POWER_LAYERS.GENERAL_OTHER,
      type: "line",
      source: POWER_SOURCES.LINES,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#999999",
        "line-width": 2.0,
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
// 変電所（ポリゴン + ポイント）
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
        "fill-opacity": 0.45,
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
        "circle-radius": 5,
        "circle-color": "#333333",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });

    // ポップアップ：OSM属性 + 空容量（capacity-engine）
    map.on("click", POWER_LAYERS.SUB_POINTS, (e) => {
      const props = attachCapacityToSubstation(e.features[0].properties);

      const html = `
        <div style="font-size:13px;font-family:sans-serif;">
          <b>${props.name || "変電所"}</b><br>
          <div>電圧: ${props.voltage || "N/A"}</div>
          <div>運営者: ${props.operator || "N/A"}</div>
          <div>空き容量: ${props.capacity_kw ?? "N/A"} kW</div>
        </div>
      `;
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    });
  }
}

// -----------------------------------------------------------------------------
// UI トグル API
// -----------------------------------------------------------------------------
export function setPowerVisibility(key, v) {
  state[key] = v;

  switch (key) {
    case "line_backbone":
      vis(POWER_LAYERS.BACKBONE_500, v);
      vis(POWER_LAYERS.BACKBONE_275, v);
      break;

    case "line_general":
      vis(POWER_LAYERS.GENERAL_154, v);
      vis(POWER_LAYERS.GENERAL_OTHER, v);
      break;

    case "substations":
      vis(POWER_LAYERS.SUB_POLY, v);
      vis(POWER_LAYERS.SUB_POINTS, v);
      break;
  }
}

// -----------------------------------------------------------------------------
// init
// -----------------------------------------------------------------------------
export function initPowerLayers(mapInstance) {
  map = mapInstance;
  addSources();
  addLineLayers();
  addSubstationLayers();

  return {
    state,
    setVisibility: setPowerVisibility,
  };
}
