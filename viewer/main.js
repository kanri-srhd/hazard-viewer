// ======================================================
//  main.js
//  全国ハザード × 地番 × 送電網 × 空き容量 統合ビューア
//  初期化コード（地理院タイル + レイヤーローダー）
//  建物 centroid 検索 + ピン管理
// ======================================================

import { detectPrefCodeFromLonLat } from './utils/prefDetect.js';
import { setPrefCode } from './layers/hazard.js';
import { parseInput } from './utils/geocode.js';
import { findNearestBuildingCentroid } from './utils/buildingLoader.js';

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
//  マーカー管理（検索用 & ユーザークリック用）
// ======================================================
let searchMarker = null;  // 検索結果のマーカー（赤）
let userMarker = null;    // ユーザークリックのマーカー（青）

// 検索マーカー追加（赤ピン）
function addSearchMarker(lng, lat) {
    // 既存の検索マーカーを削除
    removeSearchMarker();
    
    // 新しい検索マーカーを作成（赤）
    const el = document.createElement('div');
    el.style.width = '30px';
    el.style.height = '30px';
    el.style.cursor = 'pointer';
    
    searchMarker = new maplibregl.Marker({
        element: el,
        color: '#EA4335'
    })
        .setLngLat([lng, lat])
        .addTo(map);
    
    // 右クリックで削除
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        removeSearchMarker();
        console.log('[main] Search marker removed (right-click)');
    });
    
    console.log(`[main] ✓ Search marker (red) added at [${lng}, ${lat}]`);
}

// ユーザーマーカー追加（青ピン）
function addUserMarker(lng, lat) {
    // 既存のユーザーマーカーを削除
    removeUserMarker();
    
    // 新しいユーザーマーカーを作成（青）
    const el = document.createElement('div');
    el.style.width = '30px';
    el.style.height = '30px';
    el.style.cursor = 'pointer';
    
    userMarker = new maplibregl.Marker({
        element: el,
        color: '#4285F4'
    })
        .setLngLat([lng, lat])
        .addTo(map);
    
    // 右クリックで削除
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        removeUserMarker();
        console.log('[main] User marker removed (right-click)');
    });
    
    console.log(`[main] ✓ User marker (blue) added at [${lng}, ${lat}]`);
}

// 検索マーカー削除
function removeSearchMarker() {
    if (searchMarker) {
        searchMarker.remove();
        searchMarker = null;
    }
}

// ユーザーマーカー削除
function removeUserMarker() {
    if (userMarker) {
        userMarker.remove();
        userMarker = null;
    }
}

// 両方のマーカーを削除
function clearAllMarkers() {
    removeSearchMarker();
    removeUserMarker();
    console.log('[main] All markers cleared');
}

// ======================================================
//  検索機能（住所検索 → 建物 centroid のみにピン）
// ======================================================
async function executeSearch() {
    const input = document.getElementById('global-search-input');
    const query = input?.value?.trim();
    
    if (!query) {
        console.warn('[main] Empty search query');
        return;
    }
    
    console.log(`[main] Search query: "${query}"`);
    
    // 既存の検索マーカーを削除
    removeSearchMarker();
    
    try {
        // ① 入力を解析して座標取得（geocode）
        const geocodeResult = await parseInput(query);
        
        if (!geocodeResult) {
            console.error('[main] ✗ Geocode failed');
            alert('検索結果が見つかりませんでした。');
            return;
        }
        
        const { lng, lat } = geocodeResult;
        console.log(`[main] ✓ Geocode result: [${lng}, ${lat}]`);
        
        // ② 建物 centroid を探す
        console.log('[main] Searching for nearest building centroid...');
        const buildingCentroid = await findNearestBuildingCentroid(lng, lat);
        
        if (!buildingCentroid) {
            // 建物が見つからない場合
            console.warn('[main] No building found');
            
            // map.flyTo は実行（ピンは置かない）
            map.flyTo({
                center: [lng, lat],
                zoom: 18,
                duration: 2000
            });
            
            alert('建物が見つかりませんでした。\n地図を移動します。');
            return;
        }
        
        console.log(`[main] ✓ Building centroid: [${buildingCentroid.lng}, ${buildingCentroid.lat}]`);
        
        // ③ 地図を建物 centroid に移動
        map.flyTo({
            center: [buildingCentroid.lng, buildingCentroid.lat],
            zoom: 18,
            duration: 2000
        });
        
        // ④ 検索マーカーを建物 centroid に設置（赤）
        addSearchMarker(buildingCentroid.lng, buildingCentroid.lat);
        
    } catch (error) {
        console.error('[main] ✗ Search error:', error);
        alert('検索中にエラーが発生しました。');
    }
}

// ======================================================
//  UI イベント設定
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('global-search-btn');
    const searchInput = document.getElementById('global-search-input');
    const clearPinsBtn = document.getElementById('clear-pins-btn');
    const togglePhoto = document.getElementById('toggle-photo');
    const photoOpacity = document.getElementById('photo-opacity');
    
    // 検索ボタン
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
    
    // ピン削除ボタン
    if (clearPinsBtn) {
        clearPinsBtn.addEventListener('click', () => {
            console.log('[main] Clear pins button clicked');
            clearAllMarkers();
        });
    }
    
    // ------------------------------------------------------
    // 航空写真 ON/OFF
    // ------------------------------------------------------
    if (togglePhoto) {
        togglePhoto.addEventListener('change', (e) => {
            const visible = e.target.checked ? "visible" : "none";
            map.setLayoutProperty("gsi-photo-layer", "visibility", visible);
            console.log(`[main] Aerial photo: ${visible}`);
        });
    }
    
    // ------------------------------------------------------
    // 航空写真 透明度コントロール
    // ------------------------------------------------------
    if (photoOpacity) {
        photoOpacity.addEventListener('input', (e) => {
            const opacity = parseFloat(e.target.value);
            map.setPaintProperty("gsi-photo-layer", "raster-opacity", opacity);
            console.log(`[main] Aerial photo opacity: ${opacity}`);
        });
    }
});

// ======================================================
//  マップクリックでユーザーマーカーを設置（青ピン）
// ======================================================
map.on('click', (e) => {
    // Shift + Click で全マーカー削除（裏機能）
    if (e.originalEvent.shiftKey) {
        console.log('[main] Shift + Click detected');
        clearAllMarkers();
        return;
    }
    
    const lng = e.lngLat.lng;
    const lat = e.lngLat.lat;
    
    console.log(`[main] Map clicked at [${lng}, ${lat}]`);
    
    // ユーザーマーカーを設置（青）
    addUserMarker(lng, lat);
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
    
    // ------------------------------------------------------
    // 航空写真レイヤー（GSI seamlessphoto）
    // ------------------------------------------------------
    map.addSource("gsi-photo", {
        type: "raster",
        tiles: [
            "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"
        ],
        tileSize: 256,
        attribution: "© GSI Japan"
    });

    map.addLayer({
        id: "gsi-photo-layer",
        type: "raster",
        source: "gsi-photo",
        layout: { visibility: "none" },
        paint: {
            "raster-opacity": 0.4
        }
    }, "gsi-layer");
    // 標準地図の上に差し込む
    
    console.log("[main] ✓ Aerial photo layer added");
    
    loadViewerLayers();
});