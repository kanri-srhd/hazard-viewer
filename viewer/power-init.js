// viewer/power-init.js
// ============================================================================
// 送電線・変電所（OSM）レイヤー初期化
// ============================================================================

// ※ capacity-engine との連携は、実装内容を確認した上で後続ステップで統合する。
// import などで壊さないよう、現時点では純粋に OSM ベースの表示に徹する。

// -----------------------------------------------------------------------------
// MapLibre 共有インスタンス
// -----------------------------------------------------------------------------
let map;

// -----------------------------------------------------------------------------
// Source / Layer ID（PROJECT_STATE に基づく “事実”）
// -----------------------------------------------------------------------------
// viewer/index.html からの相対パス：viewer/data/osm/... → JS からは "data/osm/..." で到達
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
// UI の状態（レイヤーパネルの 3 トグルと一致させる）
// -----------------------------------------------------------------------------
// 送電線・変電所（OSM）
//   [ ] 送電線 基幹   → line_backbone
//   [ ] 送電線 一般   → line_general
//   [ ] 変電所        → substations
const state = {
  line_backbone: false,
  line_general: false,
  substations: false,
};

// -----------------------------------------------------------------------------
// Utility: 可視性
// -----------------------------------------------------------------------------
function setVisibilityInternal(layerId, visible) {
  if (!map) return;
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

// -----------------------------------------------------------------------------
// ソース追加（PROJECT_STATE のパスをそのまま使用）
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
// 送電線レイヤー（基幹 + 一般）
// -----------------------------------------------------------------------------
function addLineLayers() {
  // 500 kV（基幹：濃赤）
  if (!map.getLayer(POWER_LAYERS.BACKBONE_500)) {
    map.addLayer({
      id: POWER_LAYERS.BACKBONE_500,
      type: "line",
      source: POWER_SOURCES.LINES,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#d32f2f", // 濃赤
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          4, 1.8,
          8, 3.0,
          12, 4.5,
          14, 6.0
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

  // 275 kV（基幹：濃橙）
  if (!map.getLayer(POWER_LAYERS.BACKBONE_275)) {
    map.addLayer({
      id: POWER_LAYERS.BACKBONE_275,
      type: "line",
      source: POWER_SOURCES.LINES,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#f57c00", // 濃橙
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          4, 1.6,
          8, 2.8,
          12, 4.0,
          14, 5.5
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

  // 154 kV（一般：黄色）
  if (!map.getLayer(POWER_LAYERS.GENERAL_154)) {
    map.addLayer({
      id: POWER_LAYERS.GENERAL_154,
      type: "line",
      source: POWER_SOURCES.LINES,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#fbc02d", // 黄色
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          4, 1.4,
          8, 2.4,
          12, 3.4,
          14, 4.5
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

  // その他（一般：灰色）
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
          4, 1.2,
          8, 2.0,
          12, 3.0,
          14, 4.0
        ],
        "line-opacity": 0.8,
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
  // ポリゴン（先に追加：下地）
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

  // ポイント（上に載せる）
  if (!map.getLayer(POWER_LAYERS.SUB_POINTS)) {
    map.addLayer({
      id: POWER_LAYERS.SUB_POINTS,
      type: "circle",
      source: POWER_SOURCES.SUB_POINTS,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          4, 3,
          8, 4,
          12, 5,
          14, 6
        ],
        "circle-color": "#333333",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });

    // ポップアップ：まずは OSM 属性のみ（空容量統合は後続で capacity-engine と接続）
    map.on("click", POWER_LAYERS.SUB_POINTS, (e) => {
      if (!e.features || !e.features.length) return;
      const props = e.features[0].properties || {};

      const name = props.name || "変電所";
      const operator = props.operator || props["operator:en"] || "N/A";
      const voltage = props.voltage || (props.voltage_kv ? props.voltage_kv + " kV" : "N/A");

      const html = `
        <div style="font-size:13px;font-family:sans-serif;line-height:1.4;">
          <div style="font-weight:bold;margin-bottom:4px;">${name}</div>
          <div>運営者: ${operator}</div>
          <div>電圧: ${voltage}</div>
        </div>
      `;

      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    });

    // ホバー時にカーソルを pointer に
    map.on("mouseenter", POWER_LAYERS.SUB_POINTS, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", POWER_LAYERS.SUB_POINTS, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

// -----------------------------------------------------------------------------
// UI から呼ばれるトグル API
// -----------------------------------------------------------------------------
export function setPowerVisibility(key, visible) {
  state[key] = visible;

  switch (key) {
    case "line_backbone":
      setVisibilityInternal(POWER_LAYERS.BACKBONE_500, visible);
      setVisibilityInternal(POWER_LAYERS.BACKBONE_275, visible);
      break;

    case "line_general":
      setVisibilityInternal(POWER_LAYERS.GENERAL_154, visible);
      setVisibilityInternal(POWER_LAYERS.GENERAL_OTHER, visible);
      break;

    case "substations":
      setVisibilityInternal(POWER_LAYERS.SUB_POLY, visible);
      setVisibilityInternal(POWER_LAYERS.SUB_POINTS, visible);
      break;

    default:
      // 想定外キーは無視
      break;
  }
}

// -----------------------------------------------------------------------------
// init（main.js から呼ばれる）
// -----------------------------------------------------------------------------
// main.js 側イメージ：
//   const powerController = initPowerLayers(map);
//   initPowerLayerToggles(powerController);
export function initPowerLayers(mapInstance) {
  map = mapInstance;

  console.log("[power-init] init OSM power layers");

  addSources();
  addLineLayers();
  addSubstationLayers();

  return {
    state,
    setVisibility: setPowerVisibility,
  };
}
