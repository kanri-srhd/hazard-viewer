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

  // 500kV（濃赤：以前の表示）
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
          "interpolate", ["linear"], ["zoom"],
          3, 2.5,
          8, 4.5,
          12, 6.5,
          14, 8.5
        ],
        "line-opacity": 1.0
      },
      filter: [
        "all",
        ["has", "voltage_numeric"],
        [">=", ["get", "voltage_numeric"], 400000]  // 500kV〜
      ]
    });   // ★ BEFOREなし → 常に最前面へ
  }

  // 275kV（明るい橙）
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
          "interpolate", ["linear"], ["zoom"],
          3, 2.3,
          8, 4.0,
          12, 6.0,
          14, 8.0
        ],
        "line-opacity": 1.0
      },
      filter: [
        "all",
        ["has", "voltage_numeric"],
        [">=", ["get", "voltage_numeric"], 200000],
        ["<", ["get", "voltage_numeric"], 400000]
      ]
    });
  }

  // 154kV（黄色）
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
          "interpolate", ["linear"], ["zoom"],
          3, 1.8,
          8, 3.0,
          12, 4.8,
          14, 6.0
        ],
        "line-opacity": 1.0
      },
      filter: [
        "all",
        ["has", "voltage_numeric"],
        [">=", ["get", "voltage_numeric"], 140000],
        ["<", ["get", "voltage_numeric"], 200000]
      ]
    });
  }

  // その他（77kV以下：灰色）
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
          "interpolate", ["linear"], ["zoom"],
          3, 1.4,
          8, 2.4,
          12, 4.0,
          14, 5.0
        ],
        "line-opacity": 1.0
      },
      filter: [
        "any",
        ["!", ["has", "voltage_numeric"]],
        ["<", ["get", "voltage_numeric"], 140000]
      ]
    });
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
          "circle-stroke-color": "#004d64",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.2,
          "circle-opacity": 0.9,
        },
     });
    }
  }

// ========== 変電所ポリゴン（OpenInfraMap風） ==========
if (!map.getLayer("power-substation-polygons")) {
  map.addLayer({
    id: "power-substation-polygons",
    type: "fill",
    source: {
      type: "geojson",
      data: "data/osm/substation_polygons_base.geojson"
    },
    layout: { visibility: "none" },
    paint: {
      "fill-color": [
        "case",
        [">", ["get", "voltage_numeric"], 300000], "#d6b3ff",   // 500kV〜（紫）
        [">", ["get", "voltage_numeric"], 100000], "#e8c9a9",   // 154kV〜（薄茶）
        "#bbbbbb"                                               // その他（灰）
      ],
      "fill-opacity": 0.50,
      "fill-outline-color": "#444444"
    }
  });
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
        setLayerVisibilityById("power-substation-polygons", visible);
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

map.on("click", POWER_LAYERS.SUBSTATIONS, (e) => {
  const f = e.features[0];
  const p = f.properties;

  // ---- OSM（OpenInfraMap形式）基本属性 ----
  const name = p.name || "名称未設定";
  const operator = p.operator || "不明";

  // 電圧（複数対応）
  // OIM は "154/66 kV" のように voltage:primary, voltage:secondary を / 区切りで表現
  const v1 = p.voltage || p["voltage:primary"] || null;
  const v2 = p["voltage:secondary"] || null;

  let voltageString = "電圧不明";
  if (v1 && v2) voltageString = `${v1}/${v2} kV`;
  else if (v1) voltageString = `${v1} kV`;

  const freq = p.frequency ? `${p.frequency} Hz` : "";
  const v_f_line = freq ? `${voltageString} ${freq}` : voltageString;

  const ref = p.ref || "-";
  const type = p.substation || p.power || "不明";

  // ---- 名寄せ ----
  const normalized = window.aliasNormalizer(name);

  // ---- SRHD 空容量データ ----
  const cap = window.capacityEngine.getSubstationCapacity(normalized);

  let capacityHTML = "";

  if (cap && cap.available != null) {
    // ① 正常な容量データあり
    capacityHTML = `
      <tr><th>現容量</th><td>${cap.current_capacity} kW</td></tr>
      <tr><th>N-1 制約</th><td>${cap.n1_constraint ? "有" : "無"}</td></tr>
      <tr><th>空容量</th><td>${cap.available} kW</td></tr>
      <tr><th>更新日</th><td>${cap.updated}</td></tr>
    `;
  } else if (cap && cap.matched === false) {
    // ② 名寄せできない（名称揺れ等）
    capacityHTML = `
      <tr><td colspan="2">該当変電所が特定できません（名称不一致）</td></tr>
    `;
  } else {
    // ③ データ非公開・未取得地域等
    capacityHTML = `
      <tr><td colspan="2">空容量データ非公開（対象外）</td></tr>
    `;
  }

  // ---- Popup HTML（OIM風 + SRHD容量統合）----
  const html = `
    <div class="popup-content">
      <h3>${name}</h3>
      <h4>${v_f_line}</h4>

      <table class="popup-table">
        <tr><th>運営者</th><td>${operator}</td></tr>
        <tr><th>番号</th><td>${ref}</td></tr>
        <tr><th>変電所種類</th><td>${type}</td></tr>
      </table>

      <h4>空容量（逆潮流）</h4>
      <table class="popup-table">
        ${capacityHTML}
      </table>
    </div>
  `;

  new maplibregl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(html)
    .addTo(map);
});

  return {
    setVisibility,
    getState,
    showAll,
    hideAll,
    layers: { ...POWER_LAYERS },
    sources: { ...POWER_SOURCES },
  };
}
