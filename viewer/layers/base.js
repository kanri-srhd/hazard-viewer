// =======================================
// base.js
// 複数ベースレイヤー（GSI / APIタイル / PMTiles）対応
// =======================================

import { loadData } from "../utils/dataLoader.js";

let mapInstance = null;
let pmtilesProtocols = {};

// ---------------------------------------
// initialize base layers
// ---------------------------------------
export async function initBaseLayers(map) {
    mapInstance = map;
    console.log("[base] Initializing base layers...");

    // -------------------------
    // GSI 標準地図（main.jsで登録済）
    // -------------------------
    console.log("[base] GSI raster tile active");

    // -------------------------
    // PMTiles（全国地番など将来用）
    // -------------------------
    // 使用例：
    // const pm = await loadData({
    //     type: "pmtiles",
    //     url: "/data/jiban/pmtiles/japan.pmtiles"
    // });
    // map.addProtocol("pmtiles", (request) => pm.getZxy(request));
    // pmtilesProtocols["jiban"] = pm;

    // -------------------------
    // APIタイル（NTT / Zenrin）
    // -------------------------
    // 使用例：VectorTileとして追加する
    // const apiTileSpec = await loadData({
    //     type: "mvt",
    //     url: "https://example.api.tiles/{z}/{x}/{y}.mvt"
    // });
    //
    // map.addSource("api-base", apiTileSpec);
    // map.addLayer({
    //     id: "api-base-layer",
    //     type: "fill",
    //     source: "api-base",
    //     paint: {
    //         "fill-color": "rgba(100,100,200,0.3)"
    //     }
    // });

    // -------------------------
    // 建物タイル（背景レイヤー）
    // -------------------------
    // GeoJSON タイルとして読み込み
    map.addSource("gsi-bldg", {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    });

    map.addLayer({
        id: "gsi-bldg-fill",
        type: "fill",
        source: "gsi-bldg",
        paint: {
            "fill-color": "#d57f00",
            "fill-opacity": 0.2
        }
    }, "gsi-layer");

    map.addLayer({
        id: "gsi-bldg-outline",
        type: "line",
        source: "gsi-bldg",
        paint: {
            "line-color": "#c46e00",
            "line-width": 0.5,
            "line-opacity": 0.6
        }
    }, "gsi-bldg-fill");

    console.log("[base] ✓ Building background layers added");

    console.log("[base] Base layer initialization completed.");
}

// ---------------------------------------
// ベースレイヤーの切替（将来用）
// ---------------------------------------
export function switchBaseLayer(id) {
    // 例："gsi" / "pmtiles-jiban" / "api-infra" など
    console.log("[base] Switch base layer:", id);

    // 今後、ベースレイヤー切替ロジックを追加
}
