// ======================================================================
// ui-init.js - Google Maps風 UI コントロール + スナップショット表示
// ======================================================================

import { on } from "./bus.js";

export function initUI(map) {

    const $ = id => document.getElementById(id);

    // 🔍 検索アイコン
    const searchIcon = $("search-icon");
    if (searchIcon) {
        const img = document.createElement("img");
        img.src = "./icons/search.svg";
        img.alt = "🔍";
        searchIcon.appendChild(img);
    }

    // ☰ メニュー
    const menuBtn = $("menu-toggle");
    if (menuBtn) {
        const img = document.createElement("img");
        img.src = "./icons/menu.svg";
        img.alt = "☰";
        menuBtn.appendChild(img);
    }

    // ＋ ズームイン
    const zoomInBtn = $("zoom-in");
    if (zoomInBtn) {
        const img = document.createElement("img");
        img.src = "./icons/zoom_in.svg";
        zoomInBtn.appendChild(img);
        zoomInBtn.addEventListener("click", () => map.zoomIn({ duration: 300 }));
    }

    // − ズームアウト
    const zoomOutBtn = $("zoom-out");
    if (zoomOutBtn) {
        const img = document.createElement("img");
        img.src = "./icons/zoom_out.svg";
        zoomOutBtn.appendChild(img);
        zoomOutBtn.addEventListener("click", () => map.zoomOut({ duration: 300 }));
    }

    // 📍 現在地
    const geolocateBtn = $("geolocate");
    if (geolocateBtn) {
        const img = document.createElement("img");
        img.src = "./icons/locate.svg";
        geolocateBtn.appendChild(img);
    }

    // 🗑 ピン削除
    const clearPinsBtn = $("clear-pins");
    if (clearPinsBtn) {
        const img = document.createElement("img");
        img.src = "./icons/trash.svg";
        clearPinsBtn.appendChild(img);
    }

    // スケール表示（左下）
    const scale = new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: "metric"
    });
    map.addControl(scale, "bottom-left");

    // ★ DataBus: snapshot-updated を表示
    const panel = $("info");
    if (panel) {
        on("unified/snapshot-updated", (snapshot) => {
            panel.innerText = JSON.stringify(snapshot, null, 2);
        });
    }
}

// 注意:
// - UIは純粋に見た目とUI操作の担当。
// - ビジネスロジック（判定・統合・データ解析）は一切持たない。
// - 地図と DataBus 以外のレイヤーに依存しないこと。
// - 例えば、snapshot-updated を受け取って表示するだけの責務。