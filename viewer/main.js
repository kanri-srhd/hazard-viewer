// ======================================================
//  main.js
//  全国ハザード × 地番 × 送電網 × 空き容量 統合ビューア
//  初期化コード（地理院タイル + レイヤーローダー）
// ======================================================

import { detectPrefCodeFromLonLat } from './utils/prefDetect.js';
import { setPrefCode } from './layers/hazard.js';
import { parseInput } from './utils/geocode.js';

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
//  検索マーカー管理
// ======================================================
let searchMarker = null;  // 検索結果のマーカー

function addSearchMarker(lng, lat) {
    // 既存のマーカーを削除
    if (searchMarker) {
        searchMarker.remove();
        searchMarker = null;
    }
    
    // 新しいマーカーを作成
    searchMarker = new maplibregl.Marker({
        color: '#EA4335'  // Google Maps ライクな赤
    })
        .setLngLat([lng, lat])
        .addTo(map);
    
    console.log(`[main] ✓ Search marker added at [${lng}, ${lat}]`);
}

// ======================================================
//  検索機能
// ======================================================
async function executeSearch() {
    const input = document.getElementById('global-search-input');
    const query = input?.value?.trim();
    
    if (!query) {
        console.warn('[main] Empty search query');
        return;
    }
    
    console.log(`[main] Search query: "${query}"`);
    
    try {
        // 入力を解析して座標取得
        const result = await parseInput(query);
        
        if (!result) {
            console.error('[main] ✗ Search failed: no results');
            alert('検索結果が見つかりませんでした。\n住所・地番・座標を確認してください。');
            return;
        }
        
        const { lng, lat, title } = result;
        
        console.log(`[main] ✓ Search result: [${lng}, ${lat}]${title ? ` "${title}"` : ''}`);
        
        // 地図を移動（アニメーション付き）
        map.flyTo({
            center: [lng, lat],
            zoom: 17,
            duration: 2000
        });
        
        // マーカーを設置
        addSearchMarker(lng, lat);
        
    } catch (error) {
        console.error('[main] ✗ Search error:', error);
        alert('検索中にエラーが発生しました。');
    }
}

// 検索ボタンクリック
document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('global-search-btn');
    const searchInput = document.getElementById('global-search-input');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            console.log('[main] Search button clicked');
            executeSearch();
        });
    }
    
    // Enter キーで検索
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('[main] Enter key pressed');
                executeSearch();
            }
        });
    }
});

// ======================================================
//  地図移動時の都道府県自動判定
//  ★ detectPrefCodeFromLonLat は必ず await すること
//  ★ setPrefCode も必ず await すること
// ======================================================
let moveEndTimer = null;
let isAutoDetecting = false;  // 自動判定中フラグ（重複実行防止）

map.on('moveend', () => {
    clearTimeout(moveEndTimer);
    
    // デバウンス: 移動停止後800ms後に判定
    moveEndTimer = setTimeout(async () => {
        if (isAutoDetecting) {
            console.log('[main] Auto-detection already in progress, skipping...');
            return;
        }
        
        isAutoDetecting = true;
        
        const center = map.getCenter();
        const lon = center.lng;
        const lat = center.lat;
        
        console.log(`[main] Map moveend: center = [${lon.toFixed(6)}, ${lat.toFixed(6)}]`);
        
        try {
            // ★ 都道府県コード判定（必ず await）
            const prefCode = await detectPrefCodeFromLonLat(lon, lat);
            
            if (prefCode !== null) {
                console.log(`[main] ✓ Detected prefecture code: ${prefCode}`);
                
                // UI のセレクトボックスを更新（ui.js が追加する #pref-select）
                const prefSelect = document.getElementById('pref-select');
                if (prefSelect) {
                    const currentValue = prefSelect.value;
                    const newValue = String(prefCode);
                    
                    // 値が変わった場合のみ更新
                    if (currentValue !== newValue) {
                        console.log(`[main] Updating prefecture: ${currentValue} → ${newValue}`);
                        prefSelect.value = newValue;
                        
                        // ★ ハザードレイヤーに反映（必ず await）
                        await setPrefCode(prefCode);
                    } else {
                        console.log(`[main] Prefecture unchanged: ${prefCode}`);
                    }
                } else {
                    // UI未初期化の場合も setPrefCode を呼ぶ
                    console.log(`[main] #pref-select not found, calling setPrefCode anyway`);
                    await setPrefCode(prefCode);
                }
            } else {
                console.log('[main] ✗ No prefecture detected (outside Japan or API error)');
            }
        } catch (error) {
            console.error('[main] ✗ Error in prefecture detection:', error);
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