// ======================================================
// hazard.js
// 公式「重ねるハザードマップ」XYZタイル版
// 洪水 / 土砂 / 津波 / 液状化
// 4種類を個別にON/OFFできる構造
// ======================================================

let mapInstance = null;
let isVisible = false;    // 全体のON/OFF
let layersAdded = false;  // タイルレイヤー追加済みかどうか

// 各ハザードのタイルURL（公式）
const hazardTiles = {
    flood: {
        id: "hazard-flood",
        url: "https://disaportaldata.gsi.go.jp/raster/01/flood_l2_shinsuishin/{z}/{x}/{y}.png"
    },
    landslide: {
        id: "hazard-landslide",
        url: "https://disaportaldata.gsi.go.jp/raster/03/doseki_keikaikuiki/{z}/{x}/{y}.png"
    },
    tsunami: {
        id: "hazard-tsunami",
        url: "https://disaportaldata.gsi.go.jp/raster/05/tsunami_shinsui/{z}/{x}/{y}.png"
    },
    liquefaction: {
        id: "hazard-liquefaction",
        url: "https://disaportaldata.gsi.go.jp/raster/06/ekijoka/{z}/{x}/{y}.png"
    }
};

// ------------------------------------------------------
// 各種ハザードレイヤー（RasterLayer）を追加
// ------------------------------------------------------
function addHazardLayers() {
    if (layersAdded) return;

    for (const key of Object.keys(hazardTiles)) {
        const spec = hazardTiles[key];

        // 既に存在すれば削除
        if (mapInstance.getLayer(spec.id)) {
            mapInstance.removeLayer(spec.id);
            if (mapInstance.getSource(spec.id)) {
                mapInstance.removeSource(spec.id);
            }
        }

        // ソース追加
        mapInstance.addSource(spec.id, {
            type: "raster",
            tiles: [spec.url],
            tileSize: 256,
            attribution: "© GSI Japan / 重ねるハザードマップ"
        });

        // レイヤー追加
        mapInstance.addLayer({
            id: spec.id,
            type: "raster",
            source: spec.id,
            layout: { visibility: "none" },
            paint: {
                "raster-opacity": 0.75    // 公式色を活かしつつ透過
            }
        });

        // ★ GSIより前面に出す（これを入れないと見えない）
        mapInstance.moveLayer(spec.id);
    }

    layersAdded = true;
}

// ------------------------------------------------------
// 個別ON/OFF
// UI → hazardTypeToggle("flood", true/false)
// ------------------------------------------------------
export function hazardTypeToggle(type, show) {
    mapInstance = window.map;
    const spec = hazardTiles[type];

    if (!mapInstance.getLayer(spec.id)) return;

    mapInstance.setLayoutProperty(
        spec.id,
        "visibility",
        show ? "visible" : "none"
    );

    console.log(`[hazard] ${type} = ${show}`);
}

// ------------------------------------------------------
// 全ON/OFF（UI:「ハザード」チェックボックス用）
// ------------------------------------------------------
export function toggleLayer(show) {
    isVisible = show;
    mapInstance = window.map;

    console.log("[hazard] toggle all:", show);

    // 初回のみレイヤー作成
    addHazardLayers();

    // 全ハザード一括ON/OFF
    for (const type of Object.keys(hazardTiles)) {
        hazardTypeToggle(type, show);
    }
}
