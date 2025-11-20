// ======================================================
// hazard.js
// 動的ハザードレイヤー管理モジュール（フェーズ2）
// 都道府県コード対応 + pref_data/data 自動フォールバック
// ======================================================

let mapInstance = null;
let currentPrefCode = null;

// ハザード種別とディレクトリの対応表
const HAZARD_CONFIGS = {
    flood: {
        prefDataDir: "01_flood_l2_shinsuishin_pref_data",
        dataDir: "01_flood_l2_shinsuishin_data",
        layerId: "flood-layer",
        sourceId: "flood-src"
    },
    sediment: {
        prefDataDir: "02_dosha_kyukei_pref_data",
        dataDir: "02_dosha_kyukei_data",
        layerId: "sediment-layer",
        sourceId: "sediment-src"
    },
    tsunami: {
        prefDataDir: "03_tsunami_pref_data",
        dataDir: "03_tsunami_data",
        layerId: "tsunami-layer",
        sourceId: "tsunami-src"
    },
    liquefaction: {
        prefDataDir: "04_liquefaction_pref_data",
        dataDir: "04_liquefaction_data",
        layerId: "liquefaction-layer",
        sourceId: "liquefaction-src"
    }
};

/**
 * HEAD リクエストで pref_data URL の存在確認
 * @param {string} url - チェック対象URL
 * @returns {Promise<boolean>} - 存在すれば true
 */
async function checkUrlExists(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        
        const response = await fetch(url, {
            method: "HEAD",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
        
    } catch (error) {
        return false;
    }
}

/**
 * ハザード種別と都道府県コードから適切な URL を生成
 * @param {string} type - ハザード種別
 * @param {string|null} prefCode - 都道府県コード ("01"〜"47")
 * @returns {Promise<string>} - タイルURL（テンプレート形式）
 */
async function getHazardTileUrl(type, prefCode) {
    const config = HAZARD_CONFIGS[type];
    if (!config) {
        throw new Error(`Unknown hazard type: ${type}`);
    }
    
    const baseUrl = "https://disaportaldata.gsi.go.jp/raster";
    
    // 都道府県コードが指定されていない場合は data を使用
    if (!prefCode) {
        return `${baseUrl}/${config.dataDir}/{z}/{x}/{y}.png`;
    }
    
    // pref_data の存在確認（サンプルタイルで確認）
    const testUrl = `${baseUrl}/${config.prefDataDir}/${prefCode}/8/224/101.png`;
    const prefDataExists = await checkUrlExists(testUrl);
    
    if (prefDataExists) {
        console.log(`[hazard] ${type}: pref_data available for ${prefCode}`);
        return `${baseUrl}/${config.prefDataDir}/${prefCode}/{z}/{x}/{y}.png`;
    } else {
        console.log(`[hazard] ${type}: fallback to data for ${prefCode}`);
        return `${baseUrl}/${config.dataDir}/{z}/{x}/{y}.png`;
    }
}

/**
 * ハザードレイヤーの初期化
 * @param {maplibregl.Map} map - MapLibre インスタンス
 */
export async function initializeHazardLayers(map) {
    mapInstance = map;
    console.log("[hazard] Initializing hazard layers...");
    
    // 各ハザード種別のソース・レイヤーを追加
    for (const [type, config] of Object.entries(HAZARD_CONFIGS)) {
        const tileUrl = await getHazardTileUrl(type, currentPrefCode);
        
        // ソース追加
        if (!map.getSource(config.sourceId)) {
            map.addSource(config.sourceId, {
                type: "raster",
                tiles: [tileUrl],
                tileSize: 256,
                attribution: "© GSI ハザードマップ"
            });
        }
        
        // レイヤー追加（建物レイヤーの上に配置）
        if (!map.getLayer(config.layerId)) {
            map.addLayer({
                id: config.layerId,
                type: "raster",
                source: config.sourceId,
                layout: { visibility: "none" },
                paint: { "raster-opacity": 0.75 }
            }, "gsi-bldg-outline");
        }
    }
    
    console.log("[hazard] ✓ All hazard layers initialized");
}

/**
 * 都道府県コードを設定してハザードレイヤーを更新
 * @param {string|null} code - 都道府県コード ("01"〜"47") または null
 */
export async function setPrefCode(code) {
    if (!mapInstance) {
        console.error("[hazard] Map not initialized");
        return;
    }
    
    console.log(`[hazard] Setting prefecture code: ${code || "全国"}`);
    currentPrefCode = code;
    
    await refreshAllHazardLayers();
}

/**
 * 全ハザードレイヤーのタイルURLを更新
 */
export async function refreshAllHazardLayers() {
    if (!mapInstance) return;
    
    console.log("[hazard] Refreshing all hazard layers...");
    
    for (const [type, config] of Object.entries(HAZARD_CONFIGS)) {
        const newTileUrl = await getHazardTileUrl(type, currentPrefCode);
        const source = mapInstance.getSource(config.sourceId);
        
        if (source) {
            // タイルURLを更新（ソースを再設定）
            const visibility = mapInstance.getLayoutProperty(config.layerId, "visibility");
            
            // ソースを削除して再追加
            if (mapInstance.getLayer(config.layerId)) {
                mapInstance.removeLayer(config.layerId);
            }
            mapInstance.removeSource(config.sourceId);
            
            mapInstance.addSource(config.sourceId, {
                type: "raster",
                tiles: [newTileUrl],
                tileSize: 256,
                attribution: "© GSI ハザードマップ"
            });
            
            mapInstance.addLayer({
                id: config.layerId,
                type: "raster",
                source: config.sourceId,
                layout: { visibility: visibility || "none" },
                paint: { "raster-opacity": 0.75 }
            }, "gsi-bldg-outline");
            
            console.log(`[hazard] ✓ ${type} layer refreshed`);
        }
    }
    
    console.log("[hazard] ✓ All layers refreshed");
}

/**
 * ハザードレイヤーの表示/非表示を切り替え
 * @param {string} type - ハザード種別
 * @param {boolean} enabled - 表示する場合 true
 */
export function toggleHazard(type, enabled) {
    if (!mapInstance) {
        console.error("[hazard] Map not initialized");
        return;
    }
    
    const config = HAZARD_CONFIGS[type];
    if (!config) {
        console.error(`[hazard] Unknown hazard type: ${type}`);
        return;
    }
    
    const layer = mapInstance.getLayer(config.layerId);
    if (layer) {
        mapInstance.setLayoutProperty(
            config.layerId,
            "visibility",
            enabled ? "visible" : "none"
        );
        console.log(`[hazard] ${type}: ${enabled ? "ON" : "OFF"}`);
    }
}

/**
 * 後方互換性のためのエイリアス（旧API名）
 */
export function addHazardLayers(map) {
    return initializeHazardLayers(map);
}
