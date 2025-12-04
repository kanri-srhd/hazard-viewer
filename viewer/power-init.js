// viewer/power-init.js
// ======================================================
// OSM送電線・変電所レイヤー 初期化（全国フル実装）
// ======================================================

export const POWER_SOURCES = {
  LINES: "osm-power-lines",
  SUBSTATIONS: "osm-substations-points",
};

export const POWER_LAYERS = {
  LINE_500: "power-line-500kv",
  LINE_275: "power-line-275kv",
  LINE_154: "power-line-154kv",
  LINE_OTHER: "power-line-other",
  SUBSTATION: "power-substations",
};

const POWER_DATA_URLS = {
  LINES: "data/osm/powerlines_osm.geojson",
  SUBSTATIONS: "data/osm/substations_points.geojson",
};

export function initPowerLayers(map) {
  const state = {
    line_500kv: false,
    line_275kv: false,
    line_154kv: false,
    line_other: false,
    substations: false,
  };

  function addSources() {
    if (!map.getSource(POWER_SOURCES.LINES)) {
      map.addSource(POWER_SOURCES.LINES, {
        type: "geojson",
        data: POWER_DATA_URLS.LINES,
      });
    }

    if (!map.getSource(POWER_SOURCES.SUBSTATIONS)) {
      map.addSource(POWER_SOURCES.SUBSTATIONS, {
        type: "geojson",
        data: POWER_DATA_URLS.SUBSTATIONS,
      });
    }
  }

  const BEFORE = "gsi-photo-layer";

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
          //"line-color": "#ff0000",
          "line-color": "#ff5555",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            3, 2.0,
            8, 4.0,
            12, 6.0,
            14, 7.0
          ],
        },
        filter: [
          "all",
          ["has", "voltage_numeric"],
          [">=", ["get", "voltage_numeric"], 400000],
        ],
      }, BEFORE);
    }

    // 275kV
    if (!map.getLayer(POWER_LAYERS.LINE_275)) {
      map.addLayer({
        id: POWER_LAYERS.LINE_275,
        type: "line",
        source: POWER_SOURCES.LINES,
        minzoom: 4,
        maxzoom: 22,
        layout: { visibility: "none" },
        paint: {
          //"line-color": "#ff7f00",
          "line-color": "#d4c600",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            5, 1.3,
            9, 2.3,
            13, 3.3
          ],
        },
        filter: [
          "all",
          ["has", "voltage_numeric"],
          [">=", ["get", "voltage_numeric"], 200000],
          ["<", ["get", "voltage_numeric"], 400000],
        ],
      }, BEFORE);
    }

    // 154kV
    if (!map.getLayer(POWER_LAYERS.LINE_154)) {
      map.addLayer({
        id: POWER_LAYERS.LINE_154,
        type: "line",
        source: POWER_SOURCES.LINES,
        minzoom: 5,
        maxzoom: 22,
        layout: { visibility: "none" },
        paint: {
          //"line-color": "#ffff00",
          "line-color": "#d4c600",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            5, 1.3,
            9, 2.3,
            13, 3.3
          ],
        },
        filter: [
          "all",
          ["has", "voltage_numeric"],
          [">=", ["get", "voltage_numeric"], 140000],
          ["<", ["get", "voltage_numeric"], 200000],
        ],
      }, BEFORE);
    }

    // その他（OTHER）
    if (!map.getLayer(POWER_LAYERS.LINE_OTHER)) {
      map.addLayer({
        id: POWER_LAYERS.LINE_OTHER,
        type: "line",
        source: POWER_SOURCES.LINES,
        minzoom: 6,
        maxzoom: 22,
        layout: { visibility: "none" },
        paint: {
          //"line-color": "#999999",
          "line-color": "#666666",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            6, 1.0,
            10, 1.8,
            14, 2.6
          ],
          "line-dasharray": [2, 2],
        },
        filter: [
          "any",
          ["!", ["has", "voltage_numeric"]],
          ["<", ["get", "voltage_numeric"], 140000],
        ],
      }, BEFORE);
    }
  }

  function addSubstationLayer() {
    if (!map.getLayer(POWER_LAYERS.SUBSTATION)) {
      map.addLayer({
        id: POWER_LAYERS.SUBSTATION,
        type: "circle",
        source: POWER_SOURCES.SUBSTATIONS,
        minzoom: 5,
        maxzoom: 22,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            5, 3, 10, 5, 14, 8, 22, 12
          ],
          //"circle-color": "#00bcd4",
          "circle-color": "#00c8ff",
          //"circle-stroke-color": "#004d64",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.2,
          "circle-opacity": 0.9,
        },
      }, BEFORE);
    }
  }

  function addLayers() {
    addSources();
    addLineLayers();
    addSubstationLayer();
  }

  // loadは main.js で保証されているので即実行でOK
  function ensurePrepared() {
    addLayers();
  }

  ensurePrepared();

  function setLayerVisibilityById(layerId, visible) {
    if (!map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }

  function setVisibility(key, visible) {
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
        setLayerVisibilityById(POWER_LAYERS.SUBSTATION, visible);
        break;
    }
  }

  function showAll() {
    Object.keys(state).forEach((k) => setVisibility(k, true));
  }

  function hideAll() {
    Object.keys(state).forEach((k) => setVisibility(k, false));
  }

  function getState() {
    return { ...state };
  }

  // 透過率更新（凡例パネルから呼ばれる）
window.updatePowerOpacity = function(opacity) {

  // 基幹
  map.setPaintProperty("power-line-500kv", "line-opacity", opacity);
  map.setPaintProperty("power-line-275kv", "line-opacity", opacity);

  // 一般
  map.setPaintProperty("power-line-154kv", "line-opacity", opacity);
  map.setPaintProperty("power-line-other", "line-opacity", opacity);

  // 変電所
  map.setPaintProperty("power-substations", "circle-opacity", opacity);
};


  return {
    setVisibility,
    getState,
    showAll,
    hideAll,
    layers: { ...POWER_LAYERS },
    sources: { ...POWER_SOURCES },
  };
}
