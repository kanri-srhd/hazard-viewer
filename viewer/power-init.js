// viewer/power-init.js
// ============================================================================
// 送電線・変電所（OSM）レイヤー初期化（OIM準拠）
// ============================================================================

// capacity-engine（空容量の入口。実装は stub なので TBD のまま出す）
import { evaluateCapacity } from "../engines/capacity-engine.js";

// -----------------------------------------------------------------------------
// MapLibre インスタンス（共有）
// -----------------------------------------------------------------------------
let map;

// -----------------------------------------------------------------------------
// Source / Layer ID（PROJECT_STATE を厳守）
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
// UI 状態（レイヤーパネルと1対1対応）
// -----------------------------------------------------------------------------
const state = {
  line_backbone: false,   // 500kV + 275kV
  line_general: false,    // 154kV + その他
  substations: false,     // ポリゴン + ポイント
};

// -----------------------------------------------------------------------------
// Utility：レイヤー可視性
// -----------------------------------------------------------------------------
function setLayerVisibility(id, visible) {
  if (map && map.getLayer(id)) {
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

// -----------------------------------------------------------------------------
// ソース登録（PROJECT_STATE パスを厳守）
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
// 送電線レイヤー（OIM と同等の色分け）
// -----------------------------------------------------------------------------
function addLineLayers() {

  // 500kV（濃赤）
  if (!map.getLayer(POWER_LAYERS.BACKBONE_500)) {
    map.addLayer({
      id: POWER_LAYERS.BACKBONE_500,
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
  if (!map.getLayer(POWER_LAYERS.BACKBONE_275)) {
    map.addLayer({
      id: POWER_LAYERS.BACKBONE_275,
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
  if (!map.getLayer(POWER_LAYERS.GENERAL_154)) {
    map.addLayer({
      id: POWER_LAYERS.GENERAL_154,
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
  if (!map.getLayer(POWER_LAYERS.GENERAL_OTHER)) {
    map.addLayer({
      id: POWER_LAYERS.GENERAL_OTHER,
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
// 変電所（OIM と同じポリゴン＋小さなポイント）
// -----------------------------------------------------------------------------
function addSubstationLayers() {

  // ポリゴン（OIM と全く同じ色・outline）
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

  // ポイント（OIM の黒い小点に合わせる）
  if (!map.getLayer(POWER_LAYERS.SUB_POINTS)) {
    map.addLayer({
      id: POWER_LAYERS.SUB_POINTS,
      type: "circle",
      source: POWER_SOURCES.SUB_POINTS,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          4, 2.0, 8, 3.0, 12, 4.0, 14, 5.0
        ],
        "circle-color": "#000000",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1,
      },
    });

    // ポップアップ（OSM + 空容量入口）
    map.on("click", POWER_LAYERS.SUB_POINTS, async (e) => {
      if (!e.features?.length) return;

      const props = e.features[0].properties || {};

      // 空容量取得（現状 stub のため TBD）
      const cap = await evaluateCapacity({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });

      const html = `
        <div style="font-size:13px;font-family:sans-serif;line-height:1.4;">
          <b>${props.name || "変電所"}</b><br>
          運営者: ${props.operator || "N/A"}<br>
          電圧: ${props.voltage || "N/A"}<br>
          <hr style="margin:6px 0;">
          <b>空容量（試験実装）</b><br>
          状態: ${cap.overallDecision}<br>
          逆潮流空容量: ${cap.reverseCapacity.availableKw ?? "TBD"} kW<br>
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
    case "line_backbone":
      setLayerVisibility(POWER_LAYERS.BACKBONE_500, visible);
      setLayerVisibility(POWER_LAYERS.BACKBONE_275, visible);
      break;

    case "line_general":
      setLayerVisibility(POWER_LAYERS.GENERAL_154, visible);
      setLayerVisibility(POWER_LAYERS.GENERAL_OTHER, visible);
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
