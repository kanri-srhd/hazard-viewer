// ======================================================================
// viewer/layers/ui.js - 高機能レイヤートグルUI（フェーズ2強化版）
// 
// 機能:
// - アコーディオン式セクション（ハザード・地図・送電網・その他）
// - 都道府県セレクトボックス統合
// - 透明度スライダー（航空写真・ハザード4種）
// - 折りたたみ可能なセクション
// - レスポンシブ対応
// ======================================================================

import { PREF_POLYGONS } from "../utils/pref_polygons.js";

/**
 * レイヤートグルUIを生成（統合版）
 * @param {maplibregl.Map} map - MapLibre インスタンス
 * @param {Object} callbacks - コールバック関数群
 */
export function createLayerToggleUI(map, callbacks = {}) {
    const panel = document.getElementById("layer-control");
    if (!panel) {
        console.error("[ui] #layer-control not found");
        return;
    }

    // パネルをクリア
    panel.innerHTML = "";

    // ヘッダー
    const header = document.createElement("h3");
    header.textContent = "🗺 レイヤー管理";
    panel.appendChild(header);

    // 都道府県セレクト
    createPrefSelectSection(panel, callbacks.onPrefChange);

    // ハザードセクション
    createHazardSection(panel, map, callbacks);

    // 地図・航空写真セクション
    createMapSection(panel, map, callbacks);

    // 送電網・地番セクション
    createUtilitySection(panel, callbacks);

    console.log("[ui] Layer control UI created");
}

/**
 * 都道府県セレクトセクション
 */
function createPrefSelectSection(panel, onPrefChange) {
    const container = document.createElement("div");
    container.className = "pref-select-container";

    const label = document.createElement("label");
    label.textContent = "📍 表示都道府県";
    container.appendChild(label);

    const select = document.createElement("select");
    select.id = "prefSelect";

    // 全国オプション
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "全国";
    select.appendChild(defaultOption);

    // 47都道府県を自動生成
    PREF_POLYGONS.forEach(pref => {
        const option = document.createElement("option");
        option.value = pref.code;
        option.textContent = `${pref.name} (${pref.code})`;
        select.appendChild(option);
    });

    container.appendChild(select);
    panel.appendChild(container);

    console.log("[ui] Prefecture select populated with 47 prefectures");
}

/**
 * ハザードセクション
 */
function createHazardSection(panel, map, callbacks) {
    const section = createSection("🌊 ハザードレイヤー", [
        {
            id: "flood",
            icon: "💧",
            label: "洪水（浸水深）",
            layerId: "flood-layer",
            toggle: callbacks.toggleFlood
        },
        {
            id: "sediment",
            icon: "🏔",
            label: "土砂災害",
            layerId: "sediment-layer",
            toggle: callbacks.toggleSediment
        },
        {
            id: "tsunami",
            icon: "🌊",
            label: "津波浸水",
            layerId: "tsunami-layer",
            toggle: callbacks.toggleTsunami
        },
        {
            id: "liquefaction",
            icon: "🏗",
            label: "液状化",
            layerId: "liquefaction-layer",
            toggle: callbacks.toggleLiquefaction
        }
    ], map, true);

    panel.appendChild(section);
}

/**
 * 地図・航空写真セクション
 */
function createMapSection(panel, map, callbacks) {
    const section = createSection("🗾 地図・航空写真", [
        {
            id: "photo",
            icon: "📷",
            label: "航空写真",
            layerId: "gsi-photo-layer",
            toggle: callbacks.togglePhoto
        }
    ], map, true);

    panel.appendChild(section);
}

/**
 * 送電網・地番セクション
 */
function createUtilitySection(panel, callbacks) {
    const section = createSection("⚡ 送電網・地番", [
        {
            id: "grid",
            icon: "⚡",
            label: "送電網",
            toggle: callbacks.toggleGrid
        },
        {
            id: "jiban",
            icon: "📍",
            label: "地番",
            toggle: callbacks.toggleJiban
        },
        {
            id: "capacity",
            icon: "📊",
            label: "空き容量",
            toggle: callbacks.toggleCapacity
        }
    ], null, false);

    panel.appendChild(section);
}

/**
 * セクション生成（アコーディオン対応）
 */
function createSection(title, items, map, hasOpacity) {
    const section = document.createElement("div");
    section.className = "layer-section";

    // セクションヘッダー
    const header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = `
        <span>${title}</span>
        <span class="toggle-arrow">▼</span>
    `;

    // セクションコンテンツ
    const content = document.createElement("div");
    content.className = "section-content";

    // レイヤー項目を追加
    items.forEach(item => {
        const itemDiv = createLayerItem(item, map, hasOpacity);
        content.appendChild(itemDiv);
    });

    // アコーディオン切り替え
    header.addEventListener("click", () => {
        header.classList.toggle("collapsed");
        content.classList.toggle("collapsed");
    });

    section.appendChild(header);
    section.appendChild(content);

    return section;
}

/**
 * レイヤー項目生成
 */
function createLayerItem(item, map, hasOpacity) {
    const container = document.createElement("div");

    // チェックボックス + ラベル
    const itemDiv = document.createElement("div");
    itemDiv.className = "layer-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `chk-${item.id}`;

    const label = document.createElement("label");
    label.setAttribute("for", `chk-${item.id}`);
    label.innerHTML = `<span class="layer-icon">${item.icon}</span>${item.label}`;

    itemDiv.appendChild(checkbox);
    itemDiv.appendChild(label);
    container.appendChild(itemDiv);

    // トグル処理
    checkbox.addEventListener("change", () => {
        if (item.toggle) {
            item.toggle(checkbox.checked);
        }
    });

    // 透明度スライダー（ハザード・航空写真のみ）
    if (hasOpacity && item.layerId && map) {
        const opacityDiv = document.createElement("div");
        opacityDiv.className = "opacity-slider";

        const opacityLabel = document.createElement("label");
        opacityLabel.textContent = "透明度:";
        opacityDiv.appendChild(opacityLabel);

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "1";
        slider.step = "0.01";
        slider.value = item.id === "photo" ? "0.4" : "0.75";
        slider.id = `opacity-${item.id}`;

        slider.addEventListener("input", (e) => {
            const opacity = parseFloat(e.target.value);
            if (map.getLayer(item.layerId)) {
                map.setPaintProperty(item.layerId, "raster-opacity", opacity);
                console.log(`[ui] ${item.label} opacity: ${opacity}`);
            }
        });

        opacityDiv.appendChild(slider);
        container.appendChild(opacityDiv);
    }

    return container;
}

/**
 * パネルサイズ調整
 */
export function adjustPanelSize() {
    const panel = document.getElementById("layer-control");
    if (panel) {
        panel.style.maxHeight = Math.max(200, window.innerHeight - 100) + "px";
    }
}
