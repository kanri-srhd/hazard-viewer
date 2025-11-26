// ======================================================================
// viewer/main.js - Google Maps完全模倣UI + SVGアイコンテーマ
// 
// 機能:
// - Google Maps風 UI コンポーネント
// - ズームボタン（＋/－）
// - 現在地ボタン（GeolocateControl）
// - スケールコントロール（中央下部配置）
// - レイヤーパネル（PC: Drawer / スマホ: Bottom Sheet）
// - 赤ピン（検索結果）/ 青ピン（クリック地点）with Popup
// - 都道府県ポリゴン判定による自動県コード更新
// - ハザードレイヤー動的切替（キャッシュ高速化）
// - Google Maps風SVGアイコンセット
// ======================================================================

import { detectPrefecture } from "./utils/prefDetect.js";
import { initHazardLayers, updateHazardPref, toggleHazard } from "./layers/hazard.js";
import { initPowerLayers } from "./layers/power.js?v=20251126-01";
import { addPowerlineLayer, togglePowerlineLayer } from "./layers/powerline.js";
import { parseInput } from "./utils/geocode.js";
import { createLayerToggleUI, adjustPanelSize } from "./layers/ui.js";

// ======================================================================
// Google Maps風 SVGアイコン定義
// ======================================================================

const SVG_ICONS = {
    search: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="7" stroke="#5f6368" stroke-width="2" fill="none"/>
        <path d="M16 16l5 5" stroke="#5f6368" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    
    menu: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 7h16M4 12h16M4 17h16" stroke="#5f6368" stroke-width="2" stroke-linecap="round" fill="none"/>
    </svg>`,
    
    zoomIn: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 5v14M5 12h14" stroke="#5f6368" stroke-width="2" stroke-linecap="round" fill="none"/>
    </svg>`,
    
    zoomOut: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 12h14" stroke="#5f6368" stroke-width="2" stroke-linecap="round" fill="none"/>
    </svg>`,
    
    locate: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="3" stroke="#5f6368" stroke-width="2" fill="none"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#5f6368" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    
    trash: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="#5f6368" stroke-width="2" stroke-linecap="round" fill="none"/>
        <path d="M19 6v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="#5f6368" stroke-width="2" stroke-linecap="round" fill="none"/>
        <path d="M10 11v6M14 11v6" stroke="#5f6368" stroke-width="2" stroke-linecap="round"/>
    </svg>`
};

/**
 * SVG文字列をdata URI形式に変換
 */
function svgToDataUri(svgString) {
    return `data:image/svg+xml;base64,${btoa(svgString)}`;
}

// ======================================================================
// 定数
// ======================================================================

const MOVEEND_DEBOUNCE = 350;  // moveend デバウンス時間（ms）

// ======================================================================
// グローバル変数
// ======================================================================

let searchMarker = null;  // 赤ピン（検索結果）
let userMarker = null;    // 青ピン（クリック地点）
let currentPrefCode = null;  // 現在の都道府県コード
let moveendDebounceTimer = null;  // moveend デバウンス用タイマー
let prefSelectChanging = false;  // セレクト変更中フラグ（moveend 二重発火防止）
let lastSearchQuery = "";  // 最後の検索クエリ（Popup表示用）

// ======================================================================
// 地図初期化（大阪本社）
// ======================================================================

const map = new maplibregl.Map({
    container: "map",
    style: {
        version: 8,
        sources: {
            "gsi-std": {
                type: "raster",
                tiles: [
                    "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
                ],
                tileSize: 256,
                attribution: "© GSI"
            }
        },
        layers: [
            {
                id: "gsi-layer",
                type: "raster",
                source: "gsi-std"
            }
        ]
    },
    center: [135.5033, 34.6863],
    zoom: 15
});

// デバッグ用にグローバル公開
window.map = map;

// ======================================================================
// 地図ロード完了時の初期化
// ======================================================================

map.on("load", () => {
    console.log("[main.js] Map loaded");

    // --------------------------------------------------
    // 航空写真レイヤー追加
    // --------------------------------------------------
    map.addSource("gsi-photo", {
        type: "raster",
        tiles: ["https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"],
        tileSize: 256
    });

    map.addLayer({
        id: "gsi-photo-layer",
        type: "raster",
        source: "gsi-photo",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.4 }
    });

    // --------------------------------------------------
    // ハザードレイヤー初期化
    // --------------------------------------------------
    initHazardLayers(map, () => currentPrefCode);

    // --------------------------------------------------
    // 電力レイヤー初期化
    // --------------------------------------------------
    initPowerLayers(map);
    
    // --------------------------------------------------
    // 送電線レイヤー初期化（OSM power=line）
    // --------------------------------------------------
    addPowerlineLayer(map);
    
    // --------------------------------------------------
    // 電力インフラレイヤー初期化（変電所・送電線）
    // --------------------------------------------------
    if (window.PowerInfraLayer) {
        window.PowerInfraLayer.add(map).then(() => {
            console.log('[main] Power infrastructure layer initialized');
        }).catch(err => {
            console.error('[main] Failed to initialize power infrastructure layer:', err);
        });
    }

    // --------------------------------------------------
    // Google Maps風コントロール追加
    // --------------------------------------------------
    addGoogleMapsStyleControls();

    // --------------------------------------------------
    // 統合レイヤートグルUI生成
    // --------------------------------------------------
    createLayerToggleUI(map, {
        // 航空写真トグル
        togglePhoto: (checked) => {
            map.setLayoutProperty("gsi-photo-layer", "visibility", checked ? "visible" : "none");
        },

        // その他レイヤー（プレースホルダー）
        toggleGrid: (checked) => console.log("送電網:", checked),
        toggleJiban: (checked) => console.log("地番:", checked),
        toggleCapacity: (checked) => console.log("空き容量:", checked)
    });

    // --------------------------------------------------
    // 初期位置の都道府県判定
    // --------------------------------------------------
    const center = map.getCenter();
    updatePrefectureByCoords(center.lat, center.lng);
});

// ======================================================================
// Google Maps風コントロール追加
// ======================================================================

function addGoogleMapsStyleControls() {
    // --------------------------------------------------
    // SVGアイコンを各ボタンに適用
    // --------------------------------------------------
    const searchIcon = document.getElementById("search-icon");
    if (searchIcon) {
        const img = document.createElement("img");
        img.src = svgToDataUri(SVG_ICONS.search);
        img.alt = "🔍";
        searchIcon.appendChild(img);
    }

    const menuBtn = document.getElementById("menu-toggle");
    if (menuBtn) {
        const img = document.createElement("img");
        img.src = svgToDataUri(SVG_ICONS.menu);
        img.alt = "☰";
        menuBtn.appendChild(img);
    }

    // --------------------------------------------------
    // 手動ズームボタン（#map-controls内の + / -）
    // --------------------------------------------------
    const zoomInBtn = document.getElementById("zoom-in");
    const zoomOutBtn = document.getElementById("zoom-out");

    if (zoomInBtn) {
        const img = document.createElement("img");
        img.src = svgToDataUri(SVG_ICONS.zoomIn);
        img.alt = "+";
        zoomInBtn.appendChild(img);
        
        zoomInBtn.addEventListener("click", () => {
            map.zoomIn({ duration: 300 });
        });
    }

    if (zoomOutBtn) {
        const img = document.createElement("img");
        img.src = svgToDataUri(SVG_ICONS.zoomOut);
        img.alt = "−";
        zoomOutBtn.appendChild(img);
        
        zoomOutBtn.addEventListener("click", () => {
            map.zoomOut({ duration: 300 });
        });
    }

    // --------------------------------------------------
    // 現在地ボタン（#geolocate）
    // --------------------------------------------------
    const geolocateBtn = document.getElementById("geolocate");
    
    if (geolocateBtn) {
        const img = document.createElement("img");
        img.src = svgToDataUri(SVG_ICONS.locate);
        img.alt = "📍";
        geolocateBtn.appendChild(img);
    }
    
    // GeolocateControlをプログラムから操作するために保持
    const geolocateControl = new maplibregl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
    });
    
    // マップに追加（非表示だが機能は有効）
    map.addControl(geolocateControl, "top-left");
    
    // CSSで非表示にする
    setTimeout(() => {
        const geolocateContainer = document.querySelector(".maplibregl-ctrl-geolocate");
        if (geolocateContainer) {
            geolocateContainer.style.display = "none";
        }
    }, 100);

    if (geolocateBtn) {
        geolocateBtn.addEventListener("click", () => {
            geolocateControl.trigger();
        });
    }

    // --------------------------------------------------
    // ピン削除ボタン（#clear-pins）
    // --------------------------------------------------
    const clearPinsBtn = document.getElementById("clear-pins");
    if (clearPinsBtn) {
        const img = document.createElement("img");
        img.src = svgToDataUri(SVG_ICONS.trash);
        img.alt = "🗑";
        clearPinsBtn.appendChild(img);
    }

    // --------------------------------------------------
    // スケールコントロール（中央下部）
    // --------------------------------------------------
    const scale = new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: "metric"
    });
    map.addControl(scale, "bottom-left");

    console.log("[main.js] Google Maps-style SVG controls added");
}

// ======================================================================
// 都道府県判定 & 更新関数
// ======================================================================

/**
 * 座標から都道府県を判定し、県コードを更新
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 */
function updatePrefectureByCoords(lat, lng) {
    const pref = detectPrefecture(lat, lng);
    
    // 検出失敗時（null/undefined）
    if (!pref) {
        console.log("[main.js] 都道府県検出失敗:", lat, lng);
        return;
    }

    // 返り値が文字列 or オブジェクトの両方に対応
    const prefCode = typeof pref === "string" ? pref : pref.code;
    const prefName = typeof pref === "string" ? "" : (pref.name || "");

    console.log("[main.js] 都道府県検出:", prefName || prefCode, `(${prefCode})`);

    // 前回と同じ県ならスキップ
    if (currentPrefCode === prefCode) {
        return;
    }

    currentPrefCode = prefCode;

    // ハザードレイヤーの県コード更新
    updateHazardPref(prefCode);

    // UIセレクトボックス同期
    const prefSelect = document.getElementById("prefSelect");
    if (prefSelect && prefSelect.value !== prefCode) {
        prefSelect.value = prefCode;
        console.log("[main.js] セレクトボックス更新:", prefCode);
    }

    return prefName || prefCode;
}

// ======================================================================
// 地図移動イベント（moveend）でデバウンス付き都道府県判定
// ======================================================================

map.on("moveend", () => {
    // セレクト変更中は moveend をスキップ（二重発火防止）
    if (prefSelectChanging) {
        console.log("[main.js] moveend スキップ（セレクト変更中）");
        return;
    }

    // デバウンス処理（350ms）
    clearTimeout(moveendDebounceTimer);
    moveendDebounceTimer = setTimeout(() => {
        const center = map.getCenter();
        updatePrefectureByCoords(center.lat, center.lng);
    }, MOVEEND_DEBOUNCE);
});

// ======================================================================
// マップクリックイベント → 青ピン & Popup & 都道府県判定
// ======================================================================

map.on("click", (e) => {
    const { lng, lat } = e.lngLat;
    console.log("[main.js] マップクリック:", lat, lng);

    // 既存の青ピンを削除
    if (userMarker) {
        userMarker.remove();
    }

    // 都道府県判定
    const prefName = updatePrefectureByCoords(lat, lng);

    // Popup コンテンツ生成
    const popupContent = `
        <div class="popup">
            <div class="popup-header">📍 クリック地点</div>
            <div class="popup-row"><strong>緯度:</strong> ${lat.toFixed(6)}</div>
            <div class="popup-row"><strong>経度:</strong> ${lng.toFixed(6)}</div>
            <div class="popup-row"><strong>都道府県:</strong> ${prefName || "不明"}</div>
            <button class="popup-btn" onclick="navigator.clipboard.writeText('${lat.toFixed(6)},${lng.toFixed(6)}'); alert('座標をコピーしました');">📋 座標をコピー</button>
        </div>
    `;

    // 新しい青ピンを設置（Popup付き）
    userMarker = new maplibregl.Marker({ color: "blue" })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupContent))
        .addTo(map);

    // zIndex 設定（青ピンを最前面に）
    if (userMarker.getElement()) {
        userMarker.getElement().style.zIndex = "1000";
    }
});

// ======================================================================
// 右クリックイベント（コンテキストメニュー抑制）
// ======================================================================

map.on("contextmenu", (e) => {
    e.preventDefault();
});

// ======================================================================
// UI初期化（DOMContentLoaded で一括実行）
// ======================================================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("[main.js] DOMContentLoaded - UI初期化開始");

    setupPrefSelect();
    setupSearch();
    setupClearPins();
    setupPanelResize();

    console.log("[main.js] UI初期化完了");
});

// ======================================================================
// UI Setup 関数群
// ======================================================================

/**
 * 県セレクトボックスの初期化
 */
function setupPrefSelect() {
    const prefSelect = document.getElementById("prefSelect");
    if (!prefSelect) return;

    prefSelect.addEventListener("change", (e) => {
        const prefCode = e.target.value;
        console.log("[main.js] セレクトボックス変更:", prefCode);

        // moveend 二重発火防止フラグを立てる
        prefSelectChanging = true;

        currentPrefCode = prefCode;
        updateHazardPref(prefCode);

        // 300ms 後にフラグを解除
        setTimeout(() => {
            prefSelectChanging = false;
        }, 300);
    });
}

/**
 * 住所検索の初期化
 */
function setupSearch() {
    const searchBtn = document.getElementById("search-btn");
    const searchInput = document.getElementById("search-input");

    if (!searchBtn || !searchInput) return;

    searchBtn.addEventListener("click", async () => {
        const query = searchInput.value.trim();
        if (!query) {
            alert("検索キーワードを入力してください");
            return;
        }

        console.log("[main.js] 住所検索:", query);
        lastSearchQuery = query;

        // geocode.js の parseInput を使用
        const pos = await parseInput(query);
        if (!pos) {
            alert("位置を取得できませんでした");
            return;
        }

        console.log("[main.js] 検索結果:", pos);

        // 既存の赤ピンを削除
        if (searchMarker) {
            searchMarker.remove();
        }

        // Popup コンテンツ生成
        const popupContent = `
            <div class="popup">
                <div class="popup-header">🔍 検索結果</div>
                <div class="popup-row"><strong>検索:</strong> ${query}</div>
                <div class="popup-row"><strong>緯度:</strong> ${pos.lat.toFixed(6)}</div>
                <div class="popup-row"><strong>経度:</strong> ${pos.lng.toFixed(6)}</div>
                <button class="popup-btn" onclick="window.map.flyTo({center:[${pos.lng},${pos.lat}],zoom:17,speed:0.8});">🎯 この地点へ移動</button>
            </div>
        `;

        // 新しい赤ピンを設置（Popup付き、zIndex: 900）
        searchMarker = new maplibregl.Marker({ color: "red" })
            .setLngLat([pos.lng, pos.lat])
            .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupContent))
            .addTo(map);

        // zIndex 設定（赤ピンは青ピンより下）
        if (searchMarker.getElement()) {
            searchMarker.getElement().style.zIndex = "900";
        }

        // Google地図風にズームしながら移動
        // ※ 都道府県判定は moveend 完了後に自動実行されるため、ここでは呼ばない
        map.flyTo({
            center: [pos.lng, pos.lat],
            zoom: 17,
            speed: 0.8
        });
    });

    // Enter キーでも検索実行
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            searchBtn.click();
        }
    });
}

/**
 * ピン削除ボタンの初期化
 */
function setupClearPins() {
    const clearPinsBtn = document.getElementById("clear-pins");
    if (!clearPinsBtn) return;

    clearPinsBtn.addEventListener("click", () => {
        console.log("[main.js] ピン全削除");

        if (searchMarker) {
            searchMarker.remove();
            searchMarker = null;
        }
        if (userMarker) {
            userMarker.remove();
            userMarker = null;
        }
    });
}

/**
 * レイヤーパネルのサイズ調整初期化
 */
function setupPanelResize() {
    // リサイズイベント
    window.addEventListener("resize", adjustPanelSize);

    // 初回実行
    adjustPanelSize();
}

// ======================================================================
// デバッグ用：グローバル関数公開
// ======================================================================

window.updatePrefectureByCoords = updatePrefectureByCoords;
window.clearAllPins = () => {
    if (searchMarker) searchMarker.remove();
    if (userMarker) userMarker.remove();
    searchMarker = null;
    userMarker = null;
};

console.log("[main.js] Google Maps完全模倣UI + SVGアイコンテーマ ロード完了");
