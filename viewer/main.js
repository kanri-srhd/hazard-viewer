// ======================================================================
// viewer/main.js - Google Maps完全模倣UI + 外部SVGアイコン方式（完全版）
// ======================================================================

import { detectPrefecture } from "./utils/prefDetect.js";
import { initHazardLayers, updateHazardPref } from "./layers/hazard.js";
import { addPowerlineLayer } from "./layers/powerline.js";
import { PowerInfraLayer } from "./layers/power_infrastructure.js";
import { parseInput } from "./utils/geocode.js";
import { createLayerToggleUI, adjustPanelSize } from "./layers/ui.js";

// ======================================================================
// 定数
// ======================================================================

const MOVEEND_DEBOUNCE = 350;
const MOVEEND_MIN_DISTANCE_METERS = 300;

function distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ======================================================================
// グローバル変数
// ======================================================================

let searchMarker = null;
let userMarker = null;
let currentPrefCode = null;
let moveendDebounceTimer = null;
let prefSelectChanging = false;
let lastSearchQuery = "";
let lastPrefCheckCenter = null;

// ======================================================================
// 地図初期化
// ======================================================================

const map = new maplibregl.Map({
    container: "map",
    localIdeographFontFamily: "Meiryo, Yu Gothic UI, MS PGothic, Segoe UI Symbol",
    style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
            "gsi-std": {
                type: "raster",
                tiles: ["https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© GSI"
            }
        },
        layers: [
            { id: "gsi-layer", type: "raster", source: "gsi-std" }
        ]
    },
    center: [139.7528, 35.6850],
    zoom: 9
});

window.map = map;

// ======================================================================
// on load
// ======================================================================

map.on("load", () => {
    console.log("[main.js] Map loaded");

    // 航空写真
    map.addSource("gsi-photo", {
        type: "raster",
        tiles: ["https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"],
        tileSize: 256
    });
    map.addLayer({
        id: "gsi-photo-layer",
        type: "raster",
        source: "gsi-photo",
        layout: { visibility: "visible" },
        paint: { "raster-opacity": 0.8 }
    });

    // ハザード
    initHazardLayers(map, () => currentPrefCode);

    // 電力インフラ
    PowerInfraLayer.add(map).then(() => {
        console.log("[main] Power infrastructure layer initialized");
    }).catch(err => {
        console.error("[main] Failed to initialize power infrastructure layer:", err);
    });

    // 送電線
    addPowerlineLayer(map);

    // Google Maps風UI
    addGoogleMapsStyleControls();

    // レイヤートグルUI
    createLayerToggleUI(map, {
        togglePhoto: (on) =>
            map.setLayoutProperty("gsi-photo-layer", "visibility", on ? "visible" : "none"),
        toggleGrid: (on) => console.log("grid:", on),
        toggleJiban: (on) => console.log("jiban:", on),
        toggleCapacity: (on) => console.log("capacity:", on)
    });

    // 初期都道府県判定
    const center = map.getCenter();
    lastPrefCheckCenter = { lat: center.lat, lng: center.lng };
    updatePrefectureByCoords(center.lat, center.lng);
});

// ======================================================================
// Google Maps風 UIコントロール
// ======================================================================

function addGoogleMapsStyleControls() {

    // 検索
    const searchIcon = document.getElementById("search-icon");
    if (searchIcon) {
        const img = document.createElement("img");
        img.src = "./icons/search.svg";
        img.alt = "🔍";
        searchIcon.appendChild(img);
    }

    // メニュー
    const menuBtn = document.getElementById("menu-toggle");
    if (menuBtn) {
        const img = document.createElement("img");
        img.src = "./icons/menu.svg";
        img.alt = "☰";
        menuBtn.appendChild(img);
    }

    // ズーム IN
    const zoomInBtn = document.getElementById("zoom-in");
    if (zoomInBtn) {
        const img = document.createElement("img");
        img.src = "./icons/zoom_in.svg";
        img.alt = "+";
        zoomInBtn.appendChild(img);
        zoomInBtn.addEventListener("click", () => map.zoomIn({ duration: 300 }));
    }

    // ズーム OUT
    const zoomOutBtn = document.getElementById("zoom-out");
    if (zoomOutBtn) {
        const img = document.createElement("img");
        img.src = "./icons/zoom_out.svg";
        img.alt = "−";
        zoomOutBtn.appendChild(img);
        zoomOutBtn.addEventListener("click", () => map.zoomOut({ duration: 300 }));
    }

    // 現在地
    const geolocateBtn = document.getElementById("geolocate");
    if (geolocateBtn) {
        const img = document.createElement("img");
        img.src = "./icons/locate.svg";
        img.alt = "📍";
        geolocateBtn.appendChild(img);
    }

    // ゴミ箱
    const clearPinsBtn = document.getElementById("clear-pins");
    if (clearPinsBtn) {
        const img = document.createElement("img");
        img.src = "./icons/trash.svg";
        img.alt = "🗑";
        clearPinsBtn.appendChild(img);
    }

    // スケール
    const scale = new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: "metric"
    });
    map.addControl(scale, "bottom-left");
}

// ======================================================================
// 都道府県判定
// ======================================================================

function updatePrefectureByCoords(lat, lng) {
    const pref = detectPrefecture(lat, lng);
    if (!pref) return;

    const prefCode = typeof pref === "string" ? pref : pref.code;
    const prefName = typeof pref === "string" ? "" : (pref.name || "");

    if (currentPrefCode === prefCode) return;

    currentPrefCode = prefCode;

    console.log("[main.js] 都道府県検出:", prefName || prefCode, `(${prefCode})`);
    updateHazardPref(prefCode);

    const sel = document.getElementById("prefSelect");
    if (sel && sel.value !== prefCode) sel.value = prefCode;

    return prefName || prefCode;
}

// ======================================================================
// moveend
// ======================================================================

map.on("moveend", () => {
    if (prefSelectChanging) return;
    clearTimeout(moveendDebounceTimer);

    moveendDebounceTimer = setTimeout(() => {
        const c = map.getCenter();
        if (lastPrefCheckCenter) {
            const d = distanceMeters(lastPrefCheckCenter.lat, lastPrefCheckCenter.lng, c.lat, c.lng);
            if (d < MOVEEND_MIN_DISTANCE_METERS) {
                console.log("[main.js] moveend スキップ（中心移動が閾値未満）:", Math.round(d), "m");
                return;
            }
        }
        lastPrefCheckCenter = { lat: c.lat, lng: c.lng };
        updatePrefectureByCoords(c.lat, c.lng);
    }, MOVEEND_DEBOUNCE);
});

// ======================================================================
// map click
// ======================================================================

map.on("click", (e) => {
    const { lng, lat } = e.lngLat;
    console.log("[main.js] マップクリック:", lat, lng);

    if (userMarker) userMarker.remove();
    const prefName = updatePrefectureByCoords(lat, lng);

    const content = `
        <div class="popup">
            <div class="popup-header">📍 クリック地点</div>
            <div class="popup-row"><strong>緯度:</strong> ${lat.toFixed(6)}</div>
            <div class="popup-row"><strong>経度:</strong> ${lng.toFixed(6)}</div>
            <div class="popup-row"><strong>都道府県:</strong> ${prefName || "不明"}</div>
        </div>
    `;

    userMarker = new maplibregl.Marker({ color: "blue" })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(content))
        .addTo(map);
});

// ======================================================================
// DOMContentLoaded
// ======================================================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("[main.js] DOMContentLoaded - UI初期化開始");

    if (typeof setupPrefSelect === "function") setupPrefSelect();
    if (typeof setupSearch === "function") setupSearch();
    if (typeof setupClearPins === "function") setupClearPins();
    if (typeof setupPanelResize === "function") setupPanelResize();

    console.log("[main.js] UI初期化完了");
});

// ======================================================================

console.log("[main.js] Google Maps完全模倣UI + 外部SVGアイコンテーマ ロード完了");
