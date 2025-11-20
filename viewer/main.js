// ======================================================================
// viewer/main.js - Google Maps風UI + スマホ全画面対応版
// 
// 機能:
// - Google Maps風 UI コンポーネント
// - ズームボタン（＋/－）
// - 現在地ボタン（GeolocateControl）
// - スケールコントロール
// - レイヤーパネル（PC: Drawer / スマホ: Bottom Sheet）
// - 赤ピン（検索結果）/ 青ピン（クリック地点）with Popup
// - 都道府県ポリゴン判定による自動県コード更新
// - ハザードレイヤー動的切替（キャッシュ高速化）
// ======================================================================

import { detectPrefecture } from "./utils/prefDetect.js";
import { initializeHazardLayers, setPrefCode, toggleHazard } from "./layers/hazard.js";
import { parseInput } from "./utils/geocode.js";
import { createLayerToggleUI, adjustPanelSize } from "./layers/ui.js";

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
    initializeHazardLayers(map);

    // --------------------------------------------------
    // Google Maps風コントロール追加
    // --------------------------------------------------
    addGoogleMapsStyleControls();

    // --------------------------------------------------
    // 統合レイヤートグルUI生成
    // --------------------------------------------------
    createLayerToggleUI(map, {
        // ハザードトグル
        toggleFlood: (checked) => toggleHazard("flood", checked),
        toggleSediment: (checked) => toggleHazard("sediment", checked),
        toggleTsunami: (checked) => toggleHazard("tsunami", checked),
        toggleLiquefaction: (checked) => toggleHazard("liquefaction", checked),

        // 航空写真トグル
        togglePhoto: (checked) => {
            map.setLayoutProperty("gsi-photo-layer", "visibility", checked ? "visible" : "none");
        },

        // その他（プレースホルダー）
        toggleGrid: (checked) => console.log("送電網:", checked),
        toggleJiban: (checked) => console.log("地番:", checked),
        toggleCapacity: (checked) => console.log("空き容量:", checked),

        // 都道府県変更（setupPrefSelect で上書き）
        onPrefChange: null
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
    // 手動ズームボタン（#map-controls内の + / -）
    // --------------------------------------------------
    const zoomInBtn = document.getElementById("zoom-in");
    const zoomOutBtn = document.getElementById("zoom-out");

    if (zoomInBtn) {
        zoomInBtn.addEventListener("click", () => {
            map.zoomIn({ duration: 300 });
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener("click", () => {
            map.zoomOut({ duration: 300 });
        });
    }

    // --------------------------------------------------
    // 現在地ボタン（#geolocate）
    // --------------------------------------------------
    const geolocateBtn = document.getElementById("geolocate");
    
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
    // スケールコントロール（左下）
    // --------------------------------------------------
    const scale = new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: "metric"
    });
    map.addControl(scale, "bottom-left");

    console.log("[main.js] Google Maps-style manual controls added");
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
    setPrefCode(prefCode);

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
        setPrefCode(prefCode);

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

console.log("[main.js] Google Maps風UI + スマホ全画面対応版ロード完了");
