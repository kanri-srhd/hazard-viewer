// ======================================================
// hazard.js
// 公式「重ねるハザードマップ」XYZタイル版（全国対応）
// 洪水 / 土砂 / 津波 / 液状化
// 4種類を個別にON/OFFできる構造
// 都道府県コード（01〜47）対応で自動タイル選択
// pref_data → data Fallback 機能実装
// ======================================================

let mapInstance = null;
let layersAdded = false;  // タイルレイヤー追加済みかどうか

// ------------------------------------------------------
// 都道府県コード（動的に変更可能）
// ------------------------------------------------------
let PREF_CODE = null;  // null = 全国版, 1〜47 = 都道府県版

// ------------------------------------------------------
// ローディング表示制御
// ------------------------------------------------------
function showLoading() {
    const loadingEl = document.getElementById('hazard-loading');
    if (loadingEl) {
        loadingEl.classList.add('visible');
    }
}

function hideLoading() {
    const loadingEl = document.getElementById('hazard-loading');
    if (loadingEl) {
        loadingEl.classList.remove('visible');
    }
}

// ------------------------------------------------------
// タイルURL存在チェック（HEAD リクエスト）
// 大阪市中央区瓦町 (lon=135.5033, lat=34.6863) のタイル座標で検証
// z=14 → x=14550, y=6451
// ------------------------------------------------------
async function checkTileExists(url) {
    try {
        // {z}/{x}/{y} を実際のタイル座標に置き換え
        const testUrl = url
            .replace('{z}', '14')
            .replace('{x}', '14550')
            .replace('{y}', '6451');
        
        console.log(`[hazard] HEAD check: ${testUrl}`);
        
        const response = await fetch(testUrl, { method: 'HEAD' });
        const exists = response.ok;  // 200番台なら true
        
        console.log(`[hazard] HEAD result: ${exists ? '✓ EXISTS' : '✗ NOT FOUND'}`);
        
        return exists;
    } catch (error) {
        console.warn(`[hazard] Tile check failed for ${url}:`, error);
        return false;
    }
}

// ------------------------------------------------------
// ハザードタイルURL生成関数（Fallback 対応）
// ① pref_data (都道府県版) を HEAD チェック
// ② NG なら data (全国版) を HEAD チェック
// ③ どちらも NG なら null
// ------------------------------------------------------
async function hazardTileURL(type, prefCode) {
    const baseURL = "https://disaportaldata.gsi.go.jp/raster";
    
    // タイプ別のベースパス
    const typeMap = {
        flood: "01_flood_l2_shinsuishin",
        landslide: "03_doseki_keikaikuiki",
        tsunami: "05_tsunami_shinsui",
        liquefaction: "06_ekijoka"
    };
    
    const basePath = typeMap[type];
    if (!basePath) {
        console.error(`[hazard] Unknown hazard type: ${type}`);
        return null;
    }
    
    // 都道府県コードを2桁にゼロ埋め
    const prefStr = prefCode ? String(prefCode).padStart(2, "0") : null;
    
    // ① Fallback Step 1: pref_data (都道府県版)
    if (prefStr) {
        const prefDataURL = `${baseURL}/${basePath}_pref_data/${prefStr}/{z}/{x}/{y}.png`;
        
        console.log(`[hazard] Checking pref_data for ${type} (pref: ${prefStr})...`);
        const prefDataExists = await checkTileExists(prefDataURL);
        
        if (prefDataExists) {
            console.log(`[hazard] ✓ Using pref_data for ${type}`);
            return prefDataURL;
        } else {
            console.warn(`[hazard] ✗ pref_data not found for ${type}, trying data fallback...`);
        }
    }
    
    // ② Fallback Step 2: data (全国版)
    const dataURL = `${baseURL}/${basePath}_data/{z}/{x}/{y}.png`;
    
    console.log(`[hazard] Checking data for ${type}...`);
    const dataExists = await checkTileExists(dataURL);
    
    if (dataExists) {
        console.log(`[hazard] ✓ Using data for ${type}`);
        return dataURL;
    } else {
        console.error(`[hazard] ✗ No valid tile URL found for ${type}`);
        return null;
    }
}

// ------------------------------------------------------
// ハザードレイヤー定義（動的URL生成）
// ------------------------------------------------------
const hazardTiles = {
    flood: {
        id: "hazard-flood",
        getUrl: async () => await hazardTileURL("flood", PREF_CODE)
    },
    landslide: {
        id: "hazard-landslide",
        getUrl: async () => await hazardTileURL("landslide", PREF_CODE)
    },
    tsunami: {
        id: "hazard-tsunami",
        getUrl: async () => await hazardTileURL("tsunami", PREF_CODE)
    },
    liquefaction: {
        id: "hazard-liquefaction",
        getUrl: async () => await hazardTileURL("liquefaction", PREF_CODE)
    }
};

// ------------------------------------------------------
// 各種ハザードレイヤー（RasterLayer）を追加
// ★重要: tiles 配列には必ず文字列URLを渡すこと（Promise不可）
// ------------------------------------------------------
async function addHazardLayers() {
    if (layersAdded) {
        console.warn('[hazard] Layers already added, skipping...');
        return;
    }

    mapInstance = window.map;
    
    if (!mapInstance) {
        console.error('[hazard] Map instance not found');
        return;
    }

    console.log(`[hazard] Adding layers with PREF_CODE: ${PREF_CODE || "全国版"}`);

    for (const key of Object.keys(hazardTiles)) {
        const spec = hazardTiles[key];
        
        // ★ Promise を await で解決してから tiles 配列に渡す
        const tileURL = await spec.getUrl();

        if (!tileURL) {
            console.warn(`[hazard] Skipping ${key}: invalid URL`);
            continue;
        }

        // 既に存在すれば削除
        if (mapInstance.getLayer(spec.id)) {
            mapInstance.removeLayer(spec.id);
        }
        if (mapInstance.getSource(spec.id)) {
            mapInstance.removeSource(spec.id);
        }

        // ソース追加（tiles は文字列配列）
        mapInstance.addSource(spec.id, {
            type: "raster",
            tiles: [tileURL],  // ← 必ず文字列
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

        console.log(`[hazard] ✓ Added layer: ${spec.id} (${tileURL.includes('_pref_data') ? 'pref_data' : 'data'})`);
    }

    layersAdded = true;
    console.log('[hazard] All layers added successfully');
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
// ★ await addHazardLayers() → setTimeout(50) で確実に表示切替
// ------------------------------------------------------
export function toggleLayer(show) {
    mapInstance = window.map;

    const applyToggle = async () => {
        // 初回のみレイヤー作成
        if (!layersAdded) {
            await addHazardLayers();
            
            // ★ レイヤー追加後、タイミング問題回避のため50ms待つ
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // 全ハザード一括ON/OFF
        for (const type of Object.keys(hazardTiles)) {
            hazardTypeToggle(type, show);
        }
        
        console.log(`[hazard] toggleLayer complete: all layers ${show ? 'visible' : 'hidden'}`);
    };

    // ★ style が未ロードなら待つ
    if (!mapInstance.isStyleLoaded()) {
        mapInstance.once("styledata", applyToggle);
    } else {
        applyToggle();
    }

    console.log(`[hazard] toggleLayer requested: ${show}`);
}

// ------------------------------------------------------
// 都道府県コード変更（完全リロード + ローディング制御）
// ★ PREF_CODE 変更時は layer + source を完全削除してから再追加
// ------------------------------------------------------
export async function setPrefCode(prefCode) {
    console.log(`[hazard] setPrefCode called: ${PREF_CODE} → ${prefCode}`);
    
    // ★ 同じ値なら何もしない（重要: 無限ループ防止）
    if (PREF_CODE === prefCode) {
        console.log("[hazard] PREF_CODE unchanged, skipping reload");
        return;
    }
    
    // ローディング表示
    showLoading();
    
    try {
        // PREF_CODE を更新
        PREF_CODE = prefCode;
        
        // レイヤーが既に追加されている場合は完全リロード
        if (layersAdded) {
            console.log("[hazard] Removing existing layers...");
            
            mapInstance = window.map;
            
            // ★ 既存レイヤー & ソースを完全削除
            for (const key of Object.keys(hazardTiles)) {
                const spec = hazardTiles[key];
                
                if (mapInstance.getLayer(spec.id)) {
                    mapInstance.removeLayer(spec.id);
                    console.log(`[hazard] Removed layer: ${spec.id}`);
                }
                if (mapInstance.getSource(spec.id)) {
                    mapInstance.removeSource(spec.id);
                    console.log(`[hazard] Removed source: ${spec.id}`);
                }
            }
            
            // フラグをリセット
            layersAdded = false;
            
            // ★ 新しいPREF_CODEで再追加
            console.log(`[hazard] Reloading layers with PREF_CODE: ${prefCode || "全国版"}...`);
            await addHazardLayers();
            
            console.log("[hazard] ✓ Layers reloaded successfully");
        } else {
            console.log("[hazard] No layers to reload yet");
        }
    } catch (error) {
        console.error("[hazard] ✗ Error during setPrefCode:", error);
    } finally {
        // ★ 必ずローディング非表示
        hideLoading();
    }
}
