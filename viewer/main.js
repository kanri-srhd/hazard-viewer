// ======================================================
//  main.js
//  全国ハザード × 地番 × 送電網 × 空き容量 統合ビューア
//  初期化コード（地理院タイル + レイヤーローダー）
// ======================================================

import { detectPrefCodeFromLonLat } from './utils/prefDetect.js';
import { setPrefCode } from './layers/hazard.js';

// ------------------------------
// MapLibre の初期設定
// ------------------------------
const map = new maplibregl.Map({
    container: 'map',
    center: [135.5033, 34.6863],  // 大阪中央区河原町
    zoom: 14,
    style: {
        "version": 8,
        "sources": {
            "gsi": {
                "type": "raster",
                "tiles": [
                    "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
                ],
                "tileSize": 256,
                "attribution": "© 国土地理院"
            }
        },
        "layers": [
            {
                "id": "gsi-layer",
                "type": "raster",
                "source": "gsi",
                "minzoom": 0,
                "maxzoom": 18
            }
        ]
    },
    maxZoom: 18,
    minZoom: 5
});

window.map = map;  // グローバルアクセス用

// 縮尺コントロール追加
map.addControl(new maplibregl.ScaleControl({
    maxWidth: 200,
    unit: "metric"
}), 'bottom-left');

// ======================================================
//  地図移動時の都道府県自動判定
// ======================================================
let moveEndTimer = null;
let isAutoDetecting = false;  // 自動判定中フラグ

map.on('moveend', async () => {
    clearTimeout(moveEndTimer);
    
    // デバウンス: 移動停止後800ms後に判定
    moveEndTimer = setTimeout(async () => {
        if (isAutoDetecting) return;  // 重複実行防止
        
        isAutoDetecting = true;
        
        const center = map.getCenter();
        const lon = center.lng;
        const lat = center.lat;
        
        console.log(`[main] Map center: [${lon.toFixed(4)}, ${lat.toFixed(4)}]`);
        
        try {
            // 都道府県コード判定
            const prefCode = await detectPrefCodeFromLonLat(lon, lat);
            
            if (prefCode !== null) {
                console.log(`[main] Detected prefecture: ${prefCode}`);
                
                // UI のセレクトボックスを更新（ui.js が追加する #pref-select）
                const prefSelect = document.getElementById('pref-select');
                if (prefSelect) {
                    const currentValue = prefSelect.value;
                    const newValue = String(prefCode);
                    
                    // 値が変わった場合のみ更新
                    if (currentValue !== newValue) {
                        prefSelect.value = newValue;
                        
                        // ハザードレイヤーに反映
                        await setPrefCode(prefCode);
                    }
                }
            }
        } catch (error) {
            console.error('[main] Error in prefecture detection:', error);
        } finally {
            isAutoDetecting = false;
        }
    }, 800);
});

// ======================================================
//  レイヤーローダー
// ======================================================

// viewer/layers/*.js を読み込む（各ファイル側で登録処理を行う）
async function loadViewerLayers() {

    // utils
    await import('./utils/fetchJSON.js');
    await import('./utils/styleLoader.js');
    await import('./utils/maplibreHelpers.js');

    // base map (地理院タイルなど)
    await import('./layers/base.js');

    // 各レイヤー
    const hazardLayer = await import('./layers/hazard.js');
    const jibanLayer = await import('./layers/jiban.js');
    const gridLayer = await import('./layers/grid.js');
    const capacityLayer = await import('./layers/capacity.js');

    // レイヤーマネージャ（UI）
    const uiController = await import('./layers/ui.js');

    // UI パネルを生成
    uiController.createLayerToggleUI({
        hazard: { 
            label: "ハザード",
            toggle: (checked) => hazardLayer.toggleLayer(checked)
        },
        jiban: { 
            label: "地番",
            toggle: (checked) => jibanLayer.toggleLayer(checked)
        },
        grid: { 
            label: "送電網",
            toggle: (checked) => gridLayer.toggleLayer(checked)
        },
        capacity: { 
            label: "空き容量",
            toggle: (checked) => capacityLayer.toggleLayer(checked)
        }
    });
}

// ======================================================
//  マップ初期化後の処理
// ======================================================
map.on('load', () => {
    console.log("Map Loaded: Initializing Viewer Layers...");
    loadViewerLayers();
});