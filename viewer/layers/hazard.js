// ======================================================
// hazard.js
// 公式「重ねるハザードマップ」XYZタイル版（全国対応）
// 洪水 / 土砂 / 津波 / 液状化
// 4種類を個別にON/OFFできる構造
// 都道府県コード（01〜47）対応で自動タイル選択
// ======================================================

let mapInstance = null;
let layersAdded = false;  // タイルレイヤー追加済みかどうか

// ------------------------------------------------------
// 都道府県コード（動的に変更可能）
// ------------------------------------------------------
let PREF_CODE = null;  // null = 全国版, 1〜47 = 都道府県版

// ------------------------------------------------------
// ハザードタイルURL生成関数
// ------------------------------------------------------
function hazardTileURL(type, prefCode) {
    const baseURL = "https://disaportaldata.gsi.go.jp/raster";
    
    // 都道府県コードを2桁にゼロ埋め
    const prefStr = prefCode ? String(prefCode).padStart(2, "0") : null;
    
    switch (type) {
        case "flood":
            if (prefStr) {
                // 都道府県版（_pref_data）
                return `${baseURL}/01_flood_l2_shinsuishin_pref_data/${prefStr}/{z}/{x}/{y}.png`;
            } else {
                // 全国版（_data）
                return `${baseURL}/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png`;
            }
        
        case "landslide":
            if (prefStr) {
                // 都道府県版
                return `${baseURL}/03_doseki_keikaikuiki_pref_data/${prefStr}/{z}/{x}/{y}.png`;
            } else {
                // 全国版
                return `${baseURL}/03_doseki_keikaikuiki_data/{z}/{x}/{y}.png`;
            }
        
        case "tsunami":
            if (prefStr) {
                // 都道府県版
                return `${baseURL}/05_tsunami_shinsui_pref_data/${prefStr}/{z}/{x}/{y}.png`;
            } else {
                // 全国版
                return `${baseURL}/05_tsunami_shinsui_data/{z}/{x}/{y}.png`;
            }
        
        case "liquefaction":
            if (prefStr) {
                // 都道府県版
                return `${baseURL}/06_ekijoka_pref_data/${prefStr}/{z}/{x}/{y}.png`;
            } else {
                // 全国版
                return `${baseURL}/06_ekijoka_data/{z}/{x}/{y}.png`;
            }
        
        default:
            console.error(`[hazard] Unknown hazard type: ${type}`);
            return null;
    }
}

// ------------------------------------------------------
// ハザードレイヤー定義（動的URL生成）
// ------------------------------------------------------
const hazardTiles = {
    flood: {
        id: "hazard-flood",
        get url() {
            return hazardTileURL("flood", PREF_CODE);
        }
    },
    landslide: {
        id: "hazard-landslide",
        get url() {
            return hazardTileURL("landslide", PREF_CODE);
        }
    },
    tsunami: {
        id: "hazard-tsunami",
        get url() {
            return hazardTileURL("tsunami", PREF_CODE);
        }
    },
    liquefaction: {
        id: "hazard-liquefaction",
        get url() {
            return hazardTileURL("liquefaction", PREF_CODE);
        }
    }
};

// ------------------------------------------------------
// 各種ハザードレイヤー（RasterLayer）を追加
// ------------------------------------------------------
function addHazardLayers() {
    if (layersAdded) return;

    console.log(`[hazard] Adding layers with PREF_CODE: ${PREF_CODE || "全国版"}`);

    for (const key of Object.keys(hazardTiles)) {
        const spec = hazardTiles[key];
        const tileURL = spec.url;

        if (!tileURL) {
            console.warn(`[hazard] Skipping ${key}: invalid URL`);
            continue;
        }

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
            tiles: [tileURL],
            tileSize: 256,
            attribution: "© 国土地理院 / 重ねるハザードマップ"
        });

        // レイヤー追加（gsi-layer の上に配置）
        mapInstance.addLayer({
            id: spec.id,
            type: "raster",
            source: spec.id,
            layout: { visibility: "none" },
            paint: {
                "raster-opacity": 0.75
            }
        }, "gsi-layer");

        console.log(`[hazard] Added layer: ${spec.id}`);
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

    if (!spec) {
        console.warn(`[hazard] Unknown type: ${type}`);
        return;
    }

    if (!mapInstance.getLayer(spec.id)) {
        console.warn(`[hazard] Layer not found: ${spec.id}`);
        return;
    }

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
    mapInstance = window.map;

    const applyToggle = () => {
        // 初回のみレイヤー作成
        if (!layersAdded) {
            addHazardLayers();
        }
        
        // 全ハザード一括ON/OFF
        for (const type of Object.keys(hazardTiles)) {
            hazardTypeToggle(type, show);
        }
    };

    // ★ style が未ロードなら待つ
    if (!mapInstance.isStyleLoaded()) {
        mapInstance.once("styledata", applyToggle);
    } else {
        applyToggle();
    }

    console.log("[hazard] toggle all:", show);
}

// ------------------------------------------------------
// 都道府県コード変更（将来の拡張用）
// ------------------------------------------------------
export function setPrefCode(prefCode) {
    console.log(`[hazard] Changing PREF_CODE: ${PREF_CODE} → ${prefCode}`);
    
    PREF_CODE = prefCode;
    
    // レイヤーが既に追加されている場合は再読み込み
    if (layersAdded) {
        layersAdded = false;
        
        // 既存レイヤーを削除
        for (const key of Object.keys(hazardTiles)) {
            const spec = hazardTiles[key];
            if (mapInstance.getLayer(spec.id)) {
                mapInstance.removeLayer(spec.id);
            }
            if (mapInstance.getSource(spec.id)) {
                mapInstance.removeSource(spec.id);
            }
        }
        
        // 新しいPREF_CODEで再追加
        addHazardLayers();
        
        console.log("[hazard] Layers reloaded with new PREF_CODE");
    }
}
